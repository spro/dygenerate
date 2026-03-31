import { DurableObject } from "cloudflare:workers"

import {
    REGISTRY_OBJECT_NAME,
    SEEDED_TOOLS,
    TOOL_KEY_PREFIX,
} from "./constants"
import { HttpError } from "./http"
import {
    assertToolName,
    normalizeToolDefinition,
    toToolSummary,
    toolKey,
} from "./tool-definition"
import type { RequestPayload, ToolDefinition, ToolSummary } from "./types"

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
        const entries = await this.ctx.storage.list<ToolDefinition>({
            prefix: TOOL_KEY_PREFIX,
        })
        return [...entries.values()]
    }

    private async listToolKeys(): Promise<string[]> {
        const entries = await this.ctx.storage.list<ToolDefinition>({
            prefix: TOOL_KEY_PREFIX,
        })
        return [...entries.keys()]
    }

    private async loadStoredTool(name: string): Promise<ToolDefinition | null> {
        return (
            (await this.ctx.storage.get<ToolDefinition>(
                toolKey(assertToolName(name)),
            )) ?? null
        )
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
