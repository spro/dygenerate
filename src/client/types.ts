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

export interface GenerateFeatureResponse {
    feature: FeatureDefinition
}

export interface ApplyFeaturePromptResponse {
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

export interface FeatureRuntimeResponse {
    runtime: FeatureRuntimeRecord | null
}

export interface ErrorSection {
    label: string
    content: string
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
