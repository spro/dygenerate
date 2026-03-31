import { WorkerEntrypoint } from "cloudflare:workers"

import {
    EXPERIENCE_ID_HEADER,
    resolveExperienceId,
} from "./shared/experience"
import {
    generateComponentDefinition,
    generateFeatureDefinition,
    generateFeaturePatches,
    generateToolDefinition,
} from "./worker/ai"
import { MAX_TOOL_CALL_DEPTH } from "./worker/constants"
import {
    errorResponse,
    HttpError,
    jsonResponse,
    logRequestError,
    readJson,
} from "./worker/http"
import { getRegistry, getToolOrThrow, ToolRegistry } from "./worker/registry"
import { runToolInSandbox } from "./worker/sandbox"
import {
    assertNonEmptyString,
    assertToolName,
    toToolSummary,
} from "./worker/tool-definition"
import type {
    FeatureDefinition,
    FeaturePatch,
    FeaturePromptHistoryEntry,
    FeatureRuntimeRecord,
    RequestPayload,
} from "./worker/types"

export { ToolRegistry }

interface ToolExecutorProps {
    depth: number
    stack: string[]
    experienceId: string
}

type RouteHandler = (
    request: Request,
    env: Env,
    ctx: ExecutionContext,
) => Promise<Response>
type NamedToolRouteHandler = (
    request: Request,
    env: Env,
    ctx: ExecutionContext,
    toolName: string,
) => Promise<Response>
type RouteTable = Record<string, Partial<Record<string, RouteHandler>>>

type NamedToolRouteTable = Partial<Record<string, NamedToolRouteHandler>>

const EXACT_ROUTES: RouteTable = {
    "/api/tools": {
        GET: handleListTools,
        POST: handleSaveTool,
    },
    "/api/debug/registry": {
        GET: handleDebugRegistry,
    },
    "/api/tools/seed": {
        POST: handleSeedTools,
    },
    "/api/tools/generate": {
        POST: handleGenerateTool,
    },
    "/api/tools/clear": {
        POST: handleClearTools,
    },
    "/api/components/generate": {
        POST: handleGenerateComponent,
    },
    "/api/features/generate": {
        POST: handleGenerateFeature,
    },
    "/api/features/patch": {
        POST: handleGenerateFeaturePatch,
    },
    "/api/features/runtime": {
        GET: handleGetFeatureRuntime,
        POST: handleSaveFeatureRuntime,
        DELETE: handleClearFeatureRuntime,
    },
    "/api/run": {
        POST: handleRunTool,
    },
}

const NAMED_TOOL_ROUTES: NamedToolRouteTable = {
    GET: handleGetTool,
    DELETE: handleDeleteTool,
}

export class ToolExecutor extends WorkerEntrypoint<Env, ToolExecutorProps> {
    async fetch(): Promise<Response> {
        return new Response("Not found", { status: 404 })
    }

    async callTool(name: string, input: unknown): Promise<unknown> {
        const experienceId = resolveExperienceId(this.ctx.props.experienceId)
        const tool = await getToolOrThrow(this.env, name, experienceId)
        const currentDepth = normalizeToolCallDepth(this.ctx.props.depth)
        const currentStack = normalizeToolCallStack(this.ctx.props.stack)

        if (currentStack.includes(tool.name)) {
            throw new HttpError(
                400,
                `Recursive tool call blocked for "${tool.name}".`,
                {
                    stack: currentStack,
                    attemptedTool: tool.name,
                },
            )
        }

        const nextDepth = currentDepth + 1
        if (nextDepth > MAX_TOOL_CALL_DEPTH) {
            throw new HttpError(
                400,
                `Tool call depth limit of ${MAX_TOOL_CALL_DEPTH} was exceeded.`,
                {
                    stack: currentStack,
                    attemptedTool: tool.name,
                    maxDepth: MAX_TOOL_CALL_DEPTH,
                },
            )
        }

        const nextExecutor = this.ctx.exports.ToolExecutor({
            props: {
                depth: nextDepth,
                stack: [...currentStack, tool.name],
                experienceId,
            },
        })
        const { output } = await runToolInSandbox(this.env, tool, input, {
            toolExecutor: nextExecutor,
        })

        return output
    }
}

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext,
    ): Promise<Response> {
        try {
            return await routeRequest(request, env, ctx)
        } catch (error) {
            logRequestError(error)
            if (error instanceof HttpError) {
                return errorResponse(error, error.status)
            }
            return errorResponse(error, 500)
        }
    },
} satisfies ExportedHandler<Env>

async function routeRequest(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
): Promise<Response> {
    const url = new URL(request.url)
    const exactHandler = EXACT_ROUTES[url.pathname]?.[request.method]

    if (exactHandler) {
        return await exactHandler(request, env, ctx)
    }

    const namedToolHandler = NAMED_TOOL_ROUTES[request.method]
    if (url.pathname.startsWith("/api/tools/") && namedToolHandler) {
        const toolName = decodeNamedTool(url.pathname)
        return await namedToolHandler(request, env, ctx, toolName)
    }

    return new Response("Not found", { status: 404 })
}

function decodeNamedTool(pathname: string): string {
    const encodedToolName = pathname.slice("/api/tools/".length)
    if (!encodedToolName) {
        throw new HttpError(400, "Tool name is required.")
    }
    return decodeURIComponent(encodedToolName)
}

async function handleListTools(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    const tools = await getRequestRegistry(request, env).listTools()
    return jsonResponse({ tools })
}

async function handleGetTool(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
    name: string,
): Promise<Response> {
    const tool = await getToolOrThrow(env, name, getRequestExperienceId(request))
    return jsonResponse({ tool })
}

async function handleSaveTool(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    const body = await readJson<RequestPayload>(request)
    const tool = await getRequestRegistry(request, env).saveTool(body)
    return jsonResponse({ tool, summary: toToolSummary(tool) })
}

async function handleDeleteTool(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
    name: string,
): Promise<Response> {
    const deleted = await getRequestRegistry(request, env).deleteTool(name)
    if (!deleted) {
        throw new HttpError(404, `Tool "${name}" was not found.`)
    }
    return jsonResponse({ deleted: true, name })
}

async function handleSeedTools(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    return jsonResponse(await getRequestRegistry(request, env).seedTools())
}

async function handleClearTools(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    const deletedCount = await getRequestRegistry(request, env).clearTools()
    return jsonResponse({ deletedCount })
}

async function handleDebugRegistry(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    const url = new URL(request.url)
    const requestedToolName = url.searchParams.get("name")?.trim() ?? ""

    if (requestedToolName) {
        const tool = await getToolOrThrow(
            env,
            requestedToolName,
            getRequestExperienceId(request),
        )
        return jsonResponse({
            count: 1,
            tool,
        })
    }

    const tools = await getRequestRegistry(request, env).listStoredTools()
    return jsonResponse({
        count: tools.length,
        tools,
    })
}

async function handleGenerateTool(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    if (!env.AI) {
        throw new HttpError(
            500,
            "Workers AI binding is missing. Add an AI binding in wrangler.jsonc before generating tools.",
        )
    }

    const body = await readJson<RequestPayload>(request)
    const description = assertNonEmptyString(body.description, "description")
    const draftName = typeof body.name === "string" ? body.name.trim() : ""
    const existingTools = await getRequestRegistry(request, env).listTools()
    const tool = await generateToolDefinition(env, {
        name: draftName,
        description,
        existingTools,
    })

    return jsonResponse({ tool })
}

async function handleGenerateComponent(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    if (!env.AI) {
        throw new HttpError(
            500,
            "Workers AI binding is missing. Add an AI binding in wrangler.jsonc before generating components.",
        )
    }

    const body = await readJson<RequestPayload>(request)
    const description = assertNonEmptyString(body.description, "description")
    const toolName = assertToolName(body.toolName)
    const toolDescription =
        typeof body.toolDescription === "string" ? body.toolDescription : ""
    const inputSchemaSource =
        typeof body.inputSchemaSource === "string" ? body.inputSchemaSource : ""
    const outputSchemaSource =
        typeof body.outputSchemaSource === "string"
            ? body.outputSchemaSource
            : ""
    const exampleInput =
        typeof body.exampleInput === "string" ? body.exampleInput : "{}"

    const component = await generateComponentDefinition(env, {
        description,
        toolName,
        toolDescription,
        inputSchemaSource,
        outputSchemaSource,
        exampleInput,
    })

    return jsonResponse({ component })
}

async function handleGenerateFeature(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    if (!env.AI) {
        throw new HttpError(
            500,
            "Workers AI binding is missing. Add an AI binding in wrangler.jsonc before generating features.",
        )
    }

    const body = await readJson<RequestPayload>(request)
    const description = assertNonEmptyString(body.description, "description")
    const feature = await generateFeatureDefinition(env, {
        description,
    })

    return jsonResponse({ feature })
}

async function handleGenerateFeaturePatch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    if (!env.AI) {
        throw new HttpError(
            500,
            "Workers AI binding is missing. Add an AI binding in wrangler.jsonc before generating feature patches.",
        )
    }

    const body = await readJson<RequestPayload>(request)
    const prompt = assertNonEmptyString(body.prompt, "prompt")

    if (!body.feature || typeof body.feature !== "object") {
        throw new HttpError(400, "feature must be an object.")
    }

    const entities = Array.isArray(body.entities)
        ? body.entities.filter(
              (entity): entity is Record<string, unknown> =>
                  Boolean(entity) && typeof entity === "object",
          )
        : []

    const result = await generateFeaturePatches(env, {
        prompt,
        feature: body.feature as FeatureDefinition,
        entities,
    })

    return jsonResponse(result)
}

async function handleGetFeatureRuntime(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    const runtime = await getRequestRegistry(request, env).getFeatureRuntime()
    return jsonResponse({ runtime })
}

async function handleSaveFeatureRuntime(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    const body = await readJson<RequestPayload>(request)

    if (!body.runtime || typeof body.runtime !== "object") {
        throw new HttpError(400, "runtime must be an object.")
    }

    const savedRuntime = await getRequestRegistry(request, env).saveFeatureRuntime(
        sanitizeFeatureRuntime(body.runtime as RequestPayload),
    )

    return jsonResponse({ runtime: savedRuntime })
}

async function handleClearFeatureRuntime(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    const cleared = await getRequestRegistry(request, env).clearFeatureRuntime()
    return jsonResponse({ cleared })
}

async function handleRunTool(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
): Promise<Response> {
    const experienceId = getRequestExperienceId(request)
    const body = await readJson<RequestPayload>(request)
    const toolName = assertToolName(body.name)
    const tool = await getToolOrThrow(env, toolName, experienceId)
    const toolExecutor = ctx.exports.ToolExecutor({
        props: {
            depth: 0,
            stack: [tool.name],
            experienceId,
        },
    })
    const { output, durationMs } = await runToolInSandbox(env, tool, body.input, {
        toolExecutor,
    })

    return jsonResponse({
        name: tool.name,
        output,
        durationMs,
    })
}

function getRequestExperienceId(request: Request): string {
    return resolveExperienceId(request.headers.get(EXPERIENCE_ID_HEADER))
}

function getRequestRegistry(request: Request, env: Env) {
    return getRegistry(env, getRequestExperienceId(request))
}

function sanitizeFeatureRuntime(runtime: RequestPayload): FeatureRuntimeRecord {
    return {
        feature:
            runtime.feature && typeof runtime.feature === "object"
                ? (runtime.feature as FeatureDefinition)
                : null,
        entities: Array.isArray(runtime.entities)
            ? runtime.entities.filter(
                  (entity): entity is Record<string, unknown> =>
                      Boolean(entity) && typeof entity === "object",
              )
            : [],
        promptHistory: Array.isArray(runtime.promptHistory)
            ? runtime.promptHistory.filter(isFeaturePromptHistoryEntry)
            : [],
        updatedAt: new Date().toISOString(),
    }
}

function isFeaturePromptHistoryEntry(
    value: unknown,
): value is FeaturePromptHistoryEntry {
    if (!value || typeof value !== "object") {
        return false
    }

    const entry = value as RequestPayload
    return (
        typeof entry.prompt === "string" &&
        typeof entry.summary === "string" &&
        typeof entry.at === "string" &&
        Array.isArray(entry.appliedPatches) &&
        entry.appliedPatches.every(isFeaturePatch)
    )
}

function isFeaturePatch(value: unknown): value is FeaturePatch {
    if (!value || typeof value !== "object") {
        return false
    }

    const patch = value as RequestPayload
    return typeof patch.type === "string"
}

function normalizeToolCallDepth(value: number): number {
    return Number.isInteger(value) && value >= 0 ? value : 0
}

function normalizeToolCallStack(value: string[]): string[] {
    return Array.isArray(value)
        ? value.filter((name) => typeof name === "string" && name.length > 0)
        : []
}
