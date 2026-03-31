import { DEFAULT_EXAMPLE_INPUT, TOOL_KEY_PREFIX } from "./constants"
import { HttpError } from "./http"
import type { ToolDefinition, ToolDefinitionInput, ToolSummary } from "./types"

export function normalizeToolDefinition(
    definition: ToolDefinitionInput,
    existing: ToolDefinition | null,
): ToolDefinition {
    const name = assertToolName(definition.name)
    const description = assertNonEmptyString(
        definition.description,
        "description",
    )
    const inputSchemaSource = normalizeGeneratedSnippet(
        definition.inputSchemaSource,
    )
    const outputSchemaSource = normalizeGeneratedSnippet(
        definition.outputSchemaSource,
    )
    const executeSource = assertNonEmptyString(
        normalizeGeneratedSnippet(definition.executeSource),
        "executeSource",
    )
    const exampleInput = normalizeExampleInput(definition.exampleInput)
    const now = new Date().toISOString()

    return {
        name,
        description,
        inputSchemaSource,
        outputSchemaSource,
        exampleInput,
        executeSource,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    }
}

export function normalizeGeneratedSnippet(value: unknown): string {
    if (typeof value !== "string") {
        return ""
    }

    let text = value.trim()

    for (;;) {
        const normalized = stripOuterSnippetDelimiter(text).trim()
        if (normalized === text) {
            return text
        }
        text = normalized
    }
}

export function normalizeExampleInput(value: unknown): string {
    const text =
        typeof value === "string"
            ? normalizeGeneratedSnippet(value)
            : JSON.stringify(value ?? {}, null, 2)
    const normalizedText = text || DEFAULT_EXAMPLE_INPUT
    let parsed: unknown

    try {
        parsed = JSON.parse(normalizedText)
    } catch {
        throw new HttpError(400, "exampleInput must be valid JSON.")
    }

    return JSON.stringify(parsed, null, 2)
}

function stripOuterSnippetDelimiter(value: string): string {
    const fencedMatch = value.match(
        /^```(?:[A-Za-z0-9_-]+)?\s*([\s\S]*?)\s*```$/,
    )
    if (fencedMatch) {
        return fencedMatch[1] ?? ""
    }

    if (value.length >= 2 && value.startsWith("`") && value.endsWith("`")) {
        return value.slice(1, -1)
    }

    return value
}

export function toToolSummary(tool: ToolDefinition): ToolSummary {
    return {
        name: tool.name,
        description: tool.description,
        createdAt: tool.createdAt,
        updatedAt: tool.updatedAt,
        hasInputSchemaSource: Boolean(tool.inputSchemaSource),
        hasOutputSchemaSource: Boolean(tool.outputSchemaSource),
    }
}

export function toolKey(name: string): string {
    return `${TOOL_KEY_PREFIX}${name}`
}

export function assertToolName(value: unknown): string {
    const name = assertNonEmptyString(value, "name")
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,63}$/.test(name)) {
        throw new HttpError(
            400,
            "Tool name must start with a letter and contain only letters, numbers, hyphens, or underscores.",
        )
    }
    return name
}

export function assertNonEmptyString(
    value: unknown,
    fieldName: string,
): string {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new HttpError(400, `${fieldName} must be a non-empty string.`)
    }
    return value.trim()
}

export async function hashText(value: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value),
    )
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
}
