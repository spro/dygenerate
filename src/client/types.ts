export interface ToolSummary {
    name: string
    description: string
    createdAt: string
    updatedAt: string
    hasInputSchemaSource: boolean
}

export interface ToolDefinition {
    name: string
    description: string
    inputSchemaSource: string
    exampleInput: string
    executeSource: string
    createdAt?: string
    updatedAt?: string
    hasInputSchemaSource?: boolean
}

export interface ToolsListResponse {
    tools: ToolSummary[]
}

export interface ToolResponse {
    tool: ToolDefinition
}

export interface RunToolResponse {
    name: string
    output: unknown
    durationMs: number
}

export interface SeedToolsResponse {
    created: number
    updated: number
    total: number
}

export interface ClearToolsResponse {
    deletedCount: number
}

export interface GenerateToolResponse {
    tool: ToolDefinition
}

export interface ErrorSection {
    label: string
    content: string
}

export type PanelTone = "neutral" | "pass" | "fail"

export type PanelState =
    | {
          kind: "message"
          summary?: string
          tone?: PanelTone
          message: string
      }
    | {
          kind: "status"
          summary?: string
          tone: Exclude<PanelTone, "neutral">
          label: string
          meta: string
          sections: string[]
      }
    | {
          kind: "error"
          summary?: string
          message: string
          prominentSections: ErrorSection[]
          details?: string
      }

export interface ApiErrorPayload {
    error?: string
    details?: {
        details?: Record<string, unknown>
    }
    rawText?: string
    parseError?: string
    responseMeta?: {
        status: number
        statusText: string
        contentType: string | null
    }
    [key: string]: unknown
}

export interface InputFieldChip {
    name: string
    type: string
}

export interface RunHistoryEntry {
    status: "success" | "error"
    at: string
    durationMs?: number
    input: unknown
    output?: unknown
    message?: string
}

export type ActiveTab = "run" | "schema" | "history"

export const BLANK_TOOL: ToolDefinition = {
    name: "",
    description: "",
    inputSchemaSource: `z.object({
  text: z.string().describe("Some input to transform"),
})`,
    exampleInput: `{
  "text": "hello world"
}`,
    executeSource: `async ({ text }, tools) => {
  return {
    text: text.toUpperCase(),
  }
}`,
}
