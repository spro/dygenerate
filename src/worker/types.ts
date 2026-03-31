export interface ToolDefinition {
    name: string
    description: string
    inputSchemaSource: string
    exampleInput: string
    executeSource: string
    createdAt: string
    updatedAt: string
}

export interface ToolSummary {
    name: string
    description: string
    createdAt: string
    updatedAt: string
    hasInputSchemaSource: boolean
}

export interface ToolDefinitionInput {
    name: unknown
    description: unknown
    inputSchemaSource: unknown
    exampleInput: unknown
    executeSource: unknown
}

export interface ToolGenerationDraft {
    name: string
    description: string
    existingTools?: ToolSummary[]
}

export interface GeneratedToolDefinitionPayload {
    name: string
    description: string
    inputSchemaSource: string
    exampleInput: string
    executeSource: string
}

export interface WorkersAiRunResult {
    response?: unknown
    usage?: unknown
    tool_calls?: unknown
}

export interface SerializedErrorDetails {
    name: string
    message: string
    stack?: string
    details?: unknown
    cause?: unknown
    raw?: unknown
}

export interface RequestPayload {
    [key: string]: unknown
}
