import { WorkerEntrypoint } from "cloudflare:workers"

import { generateToolDefinition } from "./worker/ai"
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
import type { RequestPayload } from "./worker/types"

export { ToolRegistry }

interface ToolExecutorProps {
    depth: number
    stack: string[]
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
    "/api/tools/seed": {
        POST: handleSeedTools,
    },
    "/api/tools/generate": {
        POST: handleGenerateTool,
    },
    "/api/tools/clear": {
        POST: handleClearTools,
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
        const tool = await getToolOrThrow(this.env, name)
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
    _request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    const tools = await getRegistry(env).listTools()
    return jsonResponse({ tools })
}

async function handleGetTool(
    _request: Request,
    env: Env,
    _ctx: ExecutionContext,
    name: string,
): Promise<Response> {
    const tool = await getToolOrThrow(env, name)
    return jsonResponse({ tool })
}

async function handleSaveTool(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    const body = await readJson<RequestPayload>(request)
    const tool = await getRegistry(env).saveTool(body)
    return jsonResponse({ tool, summary: toToolSummary(tool) })
}

async function handleDeleteTool(
    _request: Request,
    env: Env,
    _ctx: ExecutionContext,
    name: string,
): Promise<Response> {
    const deleted = await getRegistry(env).deleteTool(name)
    if (!deleted) {
        throw new HttpError(404, `Tool "${name}" was not found.`)
    }
    return jsonResponse({ deleted: true, name })
}

async function handleSeedTools(
    _request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    return jsonResponse(await getRegistry(env).seedTools())
}

async function handleClearTools(
    _request: Request,
    env: Env,
    _ctx: ExecutionContext,
): Promise<Response> {
    const deletedCount = await getRegistry(env).clearTools()
    return jsonResponse({ deletedCount })
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
    const existingTools = await getRegistry(env).listTools()
    const tool = await generateToolDefinition(env, {
        name: draftName,
        description,
        existingTools,
    })

    return jsonResponse({ tool })
}

async function handleRunTool(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
): Promise<Response> {
    const body = await readJson<RequestPayload>(request)
    const toolName = assertToolName(body.name)
    const tool = await getToolOrThrow(env, toolName)
    const toolExecutor = ctx.exports.ToolExecutor({
        props: {
            depth: 0,
            stack: [tool.name],
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

function normalizeToolCallDepth(value: number): number {
    return Number.isInteger(value) && value >= 0 ? value : 0
}

function normalizeToolCallStack(value: string[]): string[] {
    return Array.isArray(value)
        ? value.filter((name) => typeof name === "string" && name.length > 0)
        : []
}
