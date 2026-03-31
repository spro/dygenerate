import type { InputFieldChip, RunHistoryEntry } from "./types"
import type { ToolDefinition } from "./types"

export function pushRunHistory(
    current: Record<string, RunHistoryEntry[]>,
    toolName: string,
    entry: RunHistoryEntry,
): Record<string, RunHistoryEntry[]> {
    const existing = current[toolName] ?? []
    return {
        ...current,
        [toolName]: [entry, ...existing].slice(0, 8),
    }
}

export function inferInputFields(
    tool: ToolDefinition | null,
): InputFieldChip[] {
    if (!tool) {
        return []
    }

    try {
        const parsed = JSON.parse(tool.exampleInput)
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return Object.entries(parsed).map(([name, value]) => ({
                name,
                type: inferValueType(value),
            }))
        }
    } catch {
        // Ignore invalid example input and fall back to schema parsing.
    }

    const matches = [
        ...tool.inputSchemaSource.matchAll(
            /([A-Za-z_$][\w$]*)\s*:\s*z\.([A-Za-z_$][\w$]*)/g,
        ),
    ]

    return matches.map((match) => ({
        name: match[1] ?? "field",
        type: match[2] ?? "unknown",
    }))
}

export function formatJson(value: unknown): string {
    return JSON.stringify(value, null, 2) ?? "undefined"
}

export function formatDate(value: string): string {
    return new Date(value).toLocaleString()
}

function inferValueType(value: unknown): string {
    if (Array.isArray(value)) {
        return "array"
    }

    if (value === null) {
        return "null"
    }

    return typeof value
}
