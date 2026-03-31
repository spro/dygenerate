export interface ToolDefinition {
    name: string
    description: string
    inputSchemaSource: string
    outputSchemaSource: string
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
    hasOutputSchemaSource: boolean
}

export interface ToolDefinitionInput {
    name: unknown
    description: unknown
    inputSchemaSource: unknown
    outputSchemaSource: unknown
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
    outputSchemaSource: string
    exampleInput: string
    executeSource: string
}

export interface ComponentFieldConfig {
    label: string
    helpText: string
    placeholder: string
}

export interface ComponentDefinition {
    name: string
    description: string
    kind: "toolForm"
    title: string
    subtitle: string
    submitLabel: string
    resultTitle: string
    emptyResultMessage: string
    accentColor: "stone" | "blue" | "emerald" | "violet"
    fieldConfig: Record<string, ComponentFieldConfig>
}

export interface ComponentGenerationDraft {
    description: string
    toolName: string
    toolDescription: string
    inputSchemaSource: string
    outputSchemaSource: string
    exampleInput: string
}

export interface FeatureFieldDefinition {
    type: "string" | "number" | "boolean"
    label: string
    description: string
}

export interface FeatureActionDefinition {
    name: string
    kind: "create" | "updateField" | "toggleBoolean" | "delete"
    label: string
    field?: string
}

export interface FeatureViewDefinition {
    name: string
    kind: "list" | "form" | "stats"
    title: string
    description: string
    visibleFields: string[]
}

export interface FeatureDefinition {
    name: string
    description: string
    entityName: string
    collectionName: string
    primaryField: string
    statusField?: string
    fields: Record<string, FeatureFieldDefinition>
    actions: FeatureActionDefinition[]
    views: FeatureViewDefinition[]
    initialEntities: Array<Record<string, unknown>>
}

export type FeaturePatch =
    | {
          type: "entity.add"
          entity: Record<string, unknown>
      }
    | {
          type: "entity.updateField"
          target: {
              index: number
          }
          field: string
          value: unknown
      }
    | {
          type: "entity.toggleField"
          target: {
              index: number
          }
          field: string
      }
    | {
          type: "entity.remove"
          target: {
              index: number
          }
      }
    | {
          type: "entity.replaceAll"
          entities: Array<Record<string, unknown>>
      }

export interface FeatureGenerationDraft {
    description: string
}

export interface FeaturePatchDraft {
    prompt: string
    feature: FeatureDefinition
    entities: Array<Record<string, unknown>>
}

export interface GeneratedFeaturePatchPayload {
    summary: string
    patches: FeaturePatch[]
}

export interface FeaturePromptHistoryEntry {
    prompt: string
    summary: string
    appliedPatches: FeaturePatch[]
    at: string
}

export interface FeatureRuntimeRecord {
    feature: FeatureDefinition | null
    entities: Array<Record<string, unknown>>
    promptHistory: FeaturePromptHistoryEntry[]
    updatedAt: string
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
