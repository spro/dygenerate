import { create } from "zustand"
import type {
    FeatureDefinition,
    FeaturePatch,
    FeaturePromptHistoryEntry,
    FeatureRuntimeRecord,
} from "./types"

interface GeneratedAppState {
    feature: FeatureDefinition | null
    entities: Array<Record<string, unknown>>
    promptHistory: FeaturePromptHistoryEntry[]
    setFeature: (feature: FeatureDefinition) => void
    hydrateRuntime: (runtime: FeatureRuntimeRecord | null) => void
    applyPatches: (patches: FeaturePatch[], summary: string, prompt: string) => void
    createEntity: (entity: Record<string, unknown>) => void
    updateEntityField: (index: number, field: string, value: unknown) => void
    toggleEntityField: (index: number, field: string) => void
    removeEntity: (index: number) => void
    reset: () => void
}

export const useGeneratedAppStore = create<GeneratedAppState>((set) => ({
    feature: null,
    entities: [],
    promptHistory: [],
    setFeature: (feature) =>
        set({
            feature,
            entities: feature.initialEntities ?? [],
            promptHistory: [],
        }),
    hydrateRuntime: (runtime) =>
        set({
            feature: runtime?.feature ?? null,
            entities: runtime?.entities ?? [],
            promptHistory: runtime?.promptHistory ?? [],
        }),
    applyPatches: (patches, summary, prompt) =>
        set((state) => ({
            entities: applyFeaturePatches(state.entities, patches),
            promptHistory: [
                {
                    prompt,
                    summary,
                    appliedPatches: patches,
                    at: new Date().toISOString(),
                },
                ...state.promptHistory,
            ].slice(0, 12),
        })),
    createEntity: (entity) =>
        set((state) => ({
            entities: [...state.entities, entity],
        })),
    updateEntityField: (index, field, value) =>
        set((state) => ({
            entities: state.entities.map((entity, entityIndex) =>
                entityIndex === index ? { ...entity, [field]: value } : entity,
            ),
        })),
    toggleEntityField: (index, field) =>
        set((state) => ({
            entities: state.entities.map((entity, entityIndex) =>
                entityIndex === index
                    ? { ...entity, [field]: !entity[field] }
                    : entity,
            ),
        })),
    removeEntity: (index) =>
        set((state) => ({
            entities: state.entities.filter((_, entityIndex) => entityIndex !== index),
        })),
    reset: () => set({ feature: null, entities: [], promptHistory: [] }),
}))

function applyFeaturePatches(
    currentEntities: Array<Record<string, unknown>>,
    patches: FeaturePatch[],
): Array<Record<string, unknown>> {
    let nextEntities = [...currentEntities]

    for (const patch of patches) {
        if (patch.type === "entity.add") {
            nextEntities = [...nextEntities, patch.entity]
            continue
        }

        if (patch.type === "entity.replaceAll") {
            nextEntities = [...patch.entities]
            continue
        }

        if (patch.type === "entity.remove") {
            nextEntities = nextEntities.filter(
                (_, index) => index !== patch.target.index,
            )
            continue
        }

        if (patch.type === "entity.toggleField") {
            nextEntities = nextEntities.map((entity, index) =>
                index === patch.target.index
                    ? {
                          ...entity,
                          [patch.field]: !entity[patch.field],
                      }
                    : entity,
            )
            continue
        }

        if (patch.type === "entity.updateField") {
            nextEntities = nextEntities.map((entity, index) =>
                index === patch.target.index
                    ? {
                          ...entity,
                          [patch.field]: patch.value,
                      }
                    : entity,
            )
        }
    }

    return nextEntities
}
