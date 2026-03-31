import type { Options as PrettierOptions } from "prettier"
import prettier from "prettier/standalone"
import babelPlugin from "prettier/plugins/babel"
import estreePlugin from "prettier/plugins/estree"

import { TOOL_GENERATION_SCHEMA, TOOL_GENERATOR_MODEL } from "./constants"
import {
    HttpError,
    safeJsonPreview,
    safeTextPreview,
    serializeErrorDetails,
} from "./http"
import {
    assertToolName,
    normalizeGeneratedSnippet,
    normalizeToolDefinition,
} from "./tool-definition"
import type {
    GeneratedToolDefinitionPayload,
    ToolDefinition,
    ToolGenerationDraft,
    WorkersAiRunResult,
} from "./types"

interface GeneratedToolNamePayload {
    name: string
}

const TOOL_NAME_SCHEMA = {
    type: "object",
    properties: {
        name: {
            type: "string",
            description:
                "A unique camelCase or PascalCase tool name using only letters, digits, underscores, or hyphens.",
        },
    },
    required: ["name"],
    additionalProperties: false,
} as const

export async function generateToolDefinition(
    env: Env,
    draft: ToolGenerationDraft,
): Promise<ToolDefinition> {
    const prompt = buildToolGenerationPrompt(draft)

    const result = await runAiJsonRequest(env, {
        systemPrompt:
            "You create tool definitions for a browser UI. Reply only with JSON that matches the response schema, without Markdown fences or extra backticks.",
        prompt,
        schema: TOOL_GENERATION_SCHEMA,
        temperature: 0.2,
        maxTokens: 900,
        failureMessage: `Workers AI generation failed while calling ${TOOL_GENERATOR_MODEL}.`,
    })

    const payload = parseAiObject<GeneratedToolDefinitionPayload>(
        result,
        "Workers AI returned an empty response.",
        "Workers AI returned invalid JSON for the generated tool.",
    )
    const normalizedName = await resolveGeneratedToolName(
        env,
        draft,
        payload.name,
        payload.description || draft.description,
    )
    const formattedExecuteSource = await formatGeneratedExecuteSource(
        payload.executeSource,
    )

    return normalizeToolDefinition(
        {
            name: normalizedName,
            description: payload.description || draft.description,
            inputSchemaSource: payload.inputSchemaSource,
            exampleInput: payload.exampleInput,
            executeSource: formattedExecuteSource,
        },
        null,
    )
}

async function resolveGeneratedToolName(
    env: Env,
    draft: ToolGenerationDraft,
    generatedName: string,
    description: string,
): Promise<string> {
    if (draft.name) {
        return assertToolName(draft.name)
    }

    const candidateName = assertToolName(generatedName)
    const existingNames = getExistingToolNames(draft)
    if (!existingNames.has(candidateName)) {
        return candidateName
    }

    return await generateDistinctToolName(
        env,
        draft,
        candidateName,
        description,
    )
}

async function generateDistinctToolName(
    env: Env,
    draft: ToolGenerationDraft,
    rejectedName: string,
    description: string,
): Promise<string> {
    const prompt = buildToolNameRetryPrompt(draft, rejectedName, description)

    const result = await runAiJsonRequest(env, {
        systemPrompt:
            "You rename tools for a browser UI. Reply only with JSON that matches the response schema, without Markdown fences or extra backticks.",
        prompt,
        schema: TOOL_NAME_SCHEMA,
        temperature: 0.1,
        maxTokens: 120,
        failureMessage: `Workers AI naming retry failed while calling ${TOOL_GENERATOR_MODEL}.`,
        failureDetails: {
            rejectedName,
        },
    })

    const payload = parseAiObject<GeneratedToolNamePayload>(
        result,
        "Workers AI returned an empty response while retrying the tool name.",
        "Workers AI returned invalid JSON while retrying the tool name.",
    )
    const refinedName = assertToolName(payload.name)

    if (getExistingToolNames(draft).has(refinedName)) {
        throw new HttpError(
            409,
            `Workers AI proposed the existing tool name "${refinedName}". Try again or provide a more specific description.`,
            {
                generatedName: refinedName,
                rejectedName,
            },
        )
    }

    return refinedName
}

interface AiJsonRequestOptions {
    systemPrompt: string
    prompt: string
    schema: unknown
    temperature: number
    maxTokens: number
    failureMessage: string
    failureDetails?: Record<string, unknown>
}

type AiResponseFormat =
    | {
          type: "json_schema"
          json_schema: unknown
      }
    | {
          type: "json_object"
      }

async function runAiJsonRequest(
    env: Env,
    options: AiJsonRequestOptions,
): Promise<WorkersAiRunResult> {
    try {
        return await performAiRequest(env, options, {
            type: "json_schema",
            json_schema: options.schema,
        })
    } catch (error) {
        if (!shouldRetryWithJsonObject(error)) {
            throw createAiRequestError(options, error, {
                responseFormat: "json_schema",
            })
        }

        try {
            return await performAiRequest(env, options, {
                type: "json_object",
            })
        } catch (fallbackError) {
            throw createAiRequestError(options, fallbackError, {
                responseFormat: "json_object",
                jsonSchemaRetryFailed: true,
                initialCause: serializeErrorDetails(error),
            })
        }
    }
}

async function performAiRequest(
    env: Env,
    options: AiJsonRequestOptions,
    responseFormat: AiResponseFormat,
): Promise<WorkersAiRunResult> {
    return (await env.AI.run(TOOL_GENERATOR_MODEL as keyof AiModels, {
        messages: [
            {
                role: "system",
                content: options.systemPrompt,
            },
            {
                role: "user",
                content: options.prompt,
            },
        ],
        response_format: responseFormat,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
    })) as WorkersAiRunResult
}

function shouldRetryWithJsonObject(error: unknown): boolean {
    const message = extractErrorMessage(error)
    return (
        message.includes("1031") ||
        message.includes("JSON Mode couldn't be met") ||
        message.includes("structured")
    )
}

function createAiRequestError(
    options: AiJsonRequestOptions,
    error: unknown,
    details: Record<string, unknown>,
): HttpError {
    const message = extractErrorMessage(error)
    const hint = shouldRetryWithJsonObject(error)
        ? " Workers AI could not satisfy the structured response for this request. Try a shorter description or try again."
        : ""

    return new HttpError(502, `${options.failureMessage}${hint}`, {
        model: TOOL_GENERATOR_MODEL,
        promptLength: options.prompt.length,
        systemPromptLength: options.systemPrompt.length,
        ...details,
        ...options.failureDetails,
        upstreamMessage: message,
        cause: serializeErrorDetails(error),
    })
}

function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    return String(error)
}

const GENERATED_SOURCE_FORMAT_OPTIONS = {
    parser: "babel",
    plugins: [babelPlugin, estreePlugin],
    tabWidth: 4,
    useTabs: false,
    trailingComma: "all",
    semi: false,
} satisfies PrettierOptions

async function formatGeneratedExecuteSource(value: string): Promise<string> {
    const source = normalizeGeneratedSnippet(value)
    if (!source) {
        return ""
    }

    try {
        const formatted = await prettier.format(
            source,
            GENERATED_SOURCE_FORMAT_OPTIONS,
        )
        return formatted.replace(/^;/, "").trim()
    } catch {
        return source
    }
}

function buildToolGenerationPrompt(draft: ToolGenerationDraft): string {
    return [
        "Generate a JavaScript tool definition for a Cloudflare Dynamic Worker sandbox.",
        "Return fields that match the provided JSON schema.",
        "Requirements:",
        "- inputSchemaSource must be a JavaScript expression using z.object(...).",
        "- exampleInput must be valid JSON as a string and must match the schema.",
        "- executeSource must be an async JavaScript function expression.",
        "- executeSource receives the main input object as its first argument.",
        "- executeSource may optionally accept a second argument named tools with tools.callTool(name, input) for calling another saved tool.",
        "- executeSource must return a plain JSON-serializable object.",
        "- Format executeSource cleanly with 4-space indentation, no semicolons, and readable spacing.",
        "- Do not wrap any returned field in backticks or Markdown code fences.",
        "- Do not import anything.",
        "- Do not use fetch(), network calls, Node.js APIs, or external packages.",
        "- Keep the code deterministic and practical.",
        "- The generated name must reflect what is specific about this tool, not just the generic action.",
        "- If the description includes a key differentiator like a count, format, delimiter, source/target, or transformation, include that differentiator in the name.",
        draft.name
            ? `- Use this tool name if it fits: ${draft.name}`
            : "- Generate a concise tool name in camelCase.",
        ...buildExistingToolsPrompt(draft),
        'Example: if an existing tool is named "repeatWord" and the description is "repeat this word 3 times", use a more specific name like "repeatWord3Times" or "repeat3Times", not "repeatWord".',
        `User description: ${draft.description}`,
    ].join("\n")
}

function buildToolNameRetryPrompt(
    draft: ToolGenerationDraft,
    rejectedName: string,
    description: string,
): string {
    return [
        "Propose a distinct JavaScript tool name for a Cloudflare Dynamic Worker sandbox.",
        "Return only a JSON object with the name field.",
        "Requirements:",
        "- The name must be camelCase or PascalCase.",
        "- The name must start with a letter and only use letters, digits, underscores, or hyphens.",
        "- The name must be distinct from every existing saved tool name.",
        "- Preserve the specific differentiator in the description, such as counts, formats, delimiters, or transformations.",
        `- Rejected duplicate name: ${rejectedName}`,
        ...buildExistingToolsPrompt(draft),
        'Example: if an existing tool is named "repeatWord" and the description is "repeat this word 3 times", use a more specific name like "repeatWord3Times" or "repeat3Times".',
        `User description: ${description}`,
    ].join("\n")
}

function buildExistingToolsPrompt(draft: ToolGenerationDraft): string[] {
    const existingTools = (draft.existingTools ?? [])
        .filter((tool) => tool.name !== draft.name)
        .slice(0, 25)

    if (existingTools.length === 0) {
        return []
    }

    return [
        "Existing saved tools (avoid repeating their names or purposes):",
        ...existingTools.map(
            (tool) =>
                `- ${tool.name}: ${truncateInlineText(tool.description, 140)}`,
        ),
        "- Do not duplicate or lightly rephrase an existing tool.",
        "- Prefer a distinct tool name and a meaningfully different purpose.",
    ]
}

function getExistingToolNames(draft: ToolGenerationDraft): Set<string> {
    return new Set((draft.existingTools ?? []).map((tool) => tool.name))
}

function truncateInlineText(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/g, " ").trim()
    if (normalized.length <= maxLength) {
        return normalized
    }

    return `${normalized.slice(0, maxLength - 1)}…`
}

function parseAiObject<T>(
    result: WorkersAiRunResult,
    emptyMessage: string,
    invalidJsonMessage: string,
): T {
    if (result.response && typeof result.response === "object") {
        return result.response as T
    }

    const responseText =
        typeof result.response === "string"
            ? normalizeGeneratedSnippet(result.response)
            : ""

    if (!responseText) {
        throw new HttpError(502, emptyMessage, {
            aiResultPreview: safeJsonPreview(result),
        })
    }

    try {
        return JSON.parse(responseText) as T
    } catch (error) {
        throw new HttpError(502, invalidJsonMessage, {
            responsePreview: safeTextPreview(responseText, 2500),
            responseLength: responseText.length,
            cause: serializeErrorDetails(error),
        })
    }
}
