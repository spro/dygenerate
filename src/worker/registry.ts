import { DurableObject } from "cloudflare:workers"

import {
    FEATURE_RUNTIME_KEY,
    REGISTRY_OBJECT_NAME,
    SEEDED_TOOLS,
    TOOL_KEY_PREFIX,
} from "./constants"
import { HttpError } from "./http"
import {
    assertToolName,
    normalizeGeneratedSnippet,
    normalizeToolDefinition,
    toToolSummary,
    toolKey,
} from "./tool-definition"
import type {
    FeatureRuntimeRecord,
    RequestPayload,
    ToolDefinition,
    ToolSummary,
} from "./types"

type StoredToolRecord = Omit<ToolDefinition, "outputSchemaSource"> & {
    outputSchemaSource?: string
}

export class ToolRegistry extends DurableObject {
    async listTools(): Promise<ToolSummary[]> {
        return (await this.listToolDefinitions())
            .map((tool) => toToolSummary(tool))
            .sort((left, right) => left.name.localeCompare(right.name))
    }

    async listStoredTools(): Promise<ToolDefinition[]> {
        return (await this.listToolDefinitions()).sort((left, right) =>
            left.name.localeCompare(right.name),
        )
    }

    async getTool(name: string): Promise<ToolDefinition | null> {
        return await this.loadStoredTool(name)
    }

    async getFeatureRuntime(): Promise<FeatureRuntimeRecord | null> {
        return (
            (await this.ctx.storage.get<FeatureRuntimeRecord>(
                FEATURE_RUNTIME_KEY,
            )) ?? null
        )
    }

    async saveFeatureRuntime(runtime: FeatureRuntimeRecord): Promise<FeatureRuntimeRecord> {
        await this.ctx.storage.put(FEATURE_RUNTIME_KEY, runtime)
        return runtime
    }

    async clearFeatureRuntime(): Promise<boolean> {
        return await this.ctx.storage.delete(FEATURE_RUNTIME_KEY)
    }

    async saveTool(definition: unknown): Promise<ToolDefinition> {
        const payload = assertRequestPayload(
            definition,
            "Tool definition must be an object.",
        )
        const normalizedName = assertToolName(payload.name)
        const existing = await this.loadStoredTool(normalizedName)
        const tool = normalizeToolDefinition(
            {
                name: normalizedName,
                description: payload.description,
                inputSchemaSource: payload.inputSchemaSource,
                outputSchemaSource: payload.outputSchemaSource,
                exampleInput: payload.exampleInput,
                executeSource: payload.executeSource,
            },
            existing,
        )

        await this.persistTool(tool)
        return tool
    }

    async deleteTool(name: string): Promise<boolean> {
        return await this.ctx.storage.delete(toolKey(assertToolName(name)))
    }

    async clearTools(): Promise<number> {
        const keys = await this.listToolKeys()
        return keys.length === 0 ? 0 : await this.ctx.storage.delete(keys)
    }

    async seedTools(): Promise<{
        created: number
        updated: number
        total: number
    }> {
        const counts = { created: 0, updated: 0 }

        for (const definition of SEEDED_TOOLS) {
            const seededName = assertToolName(definition.name)
            const existing = await this.loadStoredTool(seededName)
            const tool = normalizeToolDefinition(
                {
                    ...definition,
                    name: seededName,
                },
                existing,
            )

            await this.persistTool(tool)
            counts[existing ? "updated" : "created"] += 1
        }

        return {
            ...counts,
            total: counts.created + counts.updated,
        }
    }

    private async listToolDefinitions(): Promise<ToolDefinition[]> {
        const entries = await this.ctx.storage.list<StoredToolRecord>({
            prefix: TOOL_KEY_PREFIX,
        })
        return [...entries.values()].map((tool) => hydrateStoredTool(tool))
    }

    private async listToolKeys(): Promise<string[]> {
        const entries = await this.ctx.storage.list<StoredToolRecord>({
            prefix: TOOL_KEY_PREFIX,
        })
        return [...entries.keys()]
    }

    private async loadStoredTool(name: string): Promise<ToolDefinition | null> {
        const storedTool = await this.ctx.storage.get<StoredToolRecord>(
            toolKey(assertToolName(name)),
        )
        return storedTool ? hydrateStoredTool(storedTool) : null
    }

    private async persistTool(tool: ToolDefinition): Promise<void> {
        await this.ctx.storage.put(toolKey(tool.name), tool)
    }
}

export function getRegistry(env: Env) {
    return env.TOOL_REGISTRY.getByName(REGISTRY_OBJECT_NAME)
}

export async function getToolOrThrow(
    env: Env,
    name: string,
): Promise<ToolDefinition> {
    const tool = await getRegistry(env).getTool(name)
    if (!tool) {
        throw new HttpError(404, `Tool "${name}" was not found.`)
    }
    return tool
}

function assertRequestPayload(value: unknown, message: string): RequestPayload {
    if (!value || typeof value !== "object") {
        throw new HttpError(400, message)
    }

    return value as RequestPayload
}

function hydrateStoredTool(tool: StoredToolRecord): ToolDefinition {
    return {
        ...tool,
        outputSchemaSource: normalizeGeneratedSnippet(tool.outputSchemaSource),
    }
}
