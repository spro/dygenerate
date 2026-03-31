import { useEffect, useMemo, useState } from "react"
import { createErrorPanel, fetchJson, jsonRequest } from "../api"
import { useGeneratedAppStore } from "../generatedAppStore"
import { formatDate, formatJson } from "../tool-utils"
import type {
    ApplyFeaturePromptResponse,
    FeatureDefinition,
    FeatureRuntimeResponse,
    GenerateFeatureResponse,
    PanelState,
} from "../types"
import { MessageCard, Panel, StatusCard } from "./Panel"
import {
    Button,
    Field,
    TextArea,
    TextInput,
    contentCardClass,
    panelSurfaceClass,
} from "./Primitives"

export function FeatureStudio() {
    const {
        feature,
        entities,
        promptHistory,
        setFeature,
        hydrateRuntime,
        applyPatches,
        createEntity,
        updateEntityField,
        toggleEntityField,
        removeEntity,
        reset,
    } = useGeneratedAppStore()
    const [featurePrompt, setFeaturePrompt] = useState("create a todo app")
    const [followUpPrompt, setFollowUpPrompt] = useState(
        "set the second todo to done",
    )
    const [featurePanel, setFeaturePanel] = useState<PanelState | null>(null)
    const [followUpPanel, setFollowUpPanel] = useState<PanelState | null>(null)
    const [isGeneratingFeature, setIsGeneratingFeature] = useState(false)
    const [isApplyingPrompt, setIsApplyingPrompt] = useState(false)
    const [isHydratingRuntime, setIsHydratingRuntime] = useState(true)
    const [newEntityDraft, setNewEntityDraft] = useState<Record<string, string>>(
        {},
    )

    const sortedFields = useMemo(
        () =>
            feature
                ? Object.entries(feature.fields).sort(([left], [right]) =>
                      left.localeCompare(right),
                  )
                : [],
        [feature],
    )

    useEffect(() => {
        void hydratePersistedRuntime()
    }, [])

    async function hydratePersistedRuntime(): Promise<void> {
        setIsHydratingRuntime(true)
        try {
            const result = await fetchJson<FeatureRuntimeResponse>(
                "/api/features/runtime",
            )
            hydrateRuntime(result.runtime)
            if (result.runtime?.feature) {
                setNewEntityDraft(buildInitialEntityDraft(result.runtime.feature))
            }
        } catch (error) {
            setFeaturePanel(
                createErrorPanel(error, "Unable to load persisted feature runtime."),
            )
        } finally {
            setIsHydratingRuntime(false)
        }
    }

    async function persistRuntime(): Promise<void> {
        const state = useGeneratedAppStore.getState()
        await fetchJson<FeatureRuntimeResponse>(
            "/api/features/runtime",
            jsonRequest("POST", {
                runtime: {
                    feature: state.feature,
                    entities: state.entities,
                    promptHistory: state.promptHistory,
                },
            }),
        )
    }

    async function clearPersistedRuntime(): Promise<void> {
        await fetchJson<{ cleared: boolean }>(
            "/api/features/runtime",
            jsonRequest("DELETE"),
        )
    }

    async function handleGenerateFeature(): Promise<void> {
        const description = featurePrompt.trim()
        if (!description) {
            setFeaturePanel({
                kind: "message",
                tone: "fail",
                message: "Describe the app or feature you want to create.",
            })
            return
        }

        setIsGeneratingFeature(true)
        setFeaturePanel({
            kind: "message",
            message: "Workers AI is planning the shared model, actions, and views...",
        })

        try {
            const result = await fetchJson<GenerateFeatureResponse>(
                "/api/features/generate",
                jsonRequest("POST", { description }),
            )
            setFeature(result.feature)
            await persistRuntime()
            setFeaturePanel({
                kind: "message",
                tone: "pass",
                summary: result.feature.name,
                message: `Generated ${result.feature.collectionName} with ${Object.keys(result.feature.fields).length} fields and ${result.feature.actions.length} actions.`,
            })
            setFollowUpPanel(null)
            setNewEntityDraft(buildInitialEntityDraft(result.feature))
        } catch (error) {
            setFeaturePanel(createErrorPanel(error))
        } finally {
            setIsGeneratingFeature(false)
        }
    }

    async function handleApplyPrompt(): Promise<void> {
        if (!feature) {
            setFollowUpPanel({
                kind: "message",
                tone: "fail",
                message: "Generate a feature first.",
            })
            return
        }

        const prompt = followUpPrompt.trim()
        if (!prompt) {
            setFollowUpPanel({
                kind: "message",
                tone: "fail",
                message: "Describe the state change you want to make.",
            })
            return
        }

        setIsApplyingPrompt(true)
        setFollowUpPanel({
            kind: "message",
            message: "Interpreting your prompt into app state patches...",
        })

        try {
            const result = await fetchJson<ApplyFeaturePromptResponse>(
                "/api/features/patch",
                jsonRequest("POST", {
                    prompt,
                    feature,
                    entities,
                }),
            )
            applyPatches(result.patches, result.summary, prompt)
            await persistRuntime()
            setFollowUpPanel({
                kind: "status",
                tone: "pass",
                label: "Applied",
                meta: `${result.patches.length} patch${result.patches.length === 1 ? "" : "es"}`,
                sections: [result.summary, formatJson(result.patches)],
            })
        } catch (error) {
            setFollowUpPanel(createErrorPanel(error))
        } finally {
            setIsApplyingPrompt(false)
        }
    }

    async function handleCreateEntity(): Promise<void> {
        if (!feature) {
            return
        }

        const entity = materializeEntity(feature, newEntityDraft)
        createEntity(entity)
        await persistRuntime()
        setNewEntityDraft(buildInitialEntityDraft(feature))
        setFollowUpPanel({
            kind: "message",
            tone: "pass",
            summary: "State updated.",
            message: `Added a new ${feature.entityName.toLowerCase()} to the Zustand runtime.`,
        })
    }

    async function handleResetRuntime(): Promise<void> {
        reset()
        setNewEntityDraft({})
        setFollowUpPanel(null)
        try {
            await clearPersistedRuntime()
            setFeaturePanel({
                kind: "message",
                tone: "pass",
                message: "Cleared the persisted feature runtime and reset the local Zustand store.",
            })
        } catch (error) {
            setFeaturePanel(
                createErrorPanel(error, "Unable to clear persisted feature runtime."),
            )
        }
    }

    async function handleToggleEntityField(
        index: number,
        field: string,
    ): Promise<void> {
        toggleEntityField(index, field)
        await persistRuntime()
    }

    async function handleRemoveEntity(index: number): Promise<void> {
        removeEntity(index)
        await persistRuntime()
    }

    async function handleUpdateEntityField(
        index: number,
        field: string,
        value: unknown,
    ): Promise<void> {
        updateEntityField(index, field, value)
        await persistRuntime()
    }

    return (
        <section className={panelSurfaceClass}>
            <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="grid min-w-0 gap-4">
                    <div className={contentCardClass}>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-medium text-stone-900">
                                    Live app runtime
                                </div>
                                <div className="text-sm text-stone-500">
                                    Trusted rendering of generated feature definitions.
                                </div>
                            </div>
                            <div className="text-sm text-stone-500">
                                {feature
                                    ? `${entities.length} ${feature.collectionName}`
                                    : "No feature yet"}
                            </div>
                        </div>

                        {isHydratingRuntime ? (
                            <div className="mt-4">
                                <MessageCard message="Loading persisted feature runtime..." />
                            </div>
                        ) : !feature ? (
                            <div className="mt-4">
                                <MessageCard message="Generate a feature to see the live stateful preview here." />
                            </div>
                        ) : (
                            <FeatureRuntimePreview
                                feature={feature}
                                entities={entities}
                                newEntityDraft={newEntityDraft}
                                onDraftChange={(field, value) =>
                                    setNewEntityDraft((current) => ({
                                        ...current,
                                        [field]: value,
                                    }))
                                }
                                onCreateEntity={() => void handleCreateEntity()}
                                onToggleEntityField={(index, field) =>
                                    void handleToggleEntityField(index, field)
                                }
                                onRemoveEntity={(index) =>
                                    void handleRemoveEntity(index)
                                }
                                onUpdateEntityField={(index, field, value) =>
                                    void handleUpdateEntityField(index, field, value)
                                }
                            />
                        )}
                    </div>

                    <div className={contentCardClass}>
                        <div className="text-sm font-medium text-stone-900">
                            Feature definition
                        </div>
                        {!feature ? (
                            <div className="mt-3">
                                <MessageCard message="No generated feature definition yet." />
                            </div>
                        ) : (
                            <>
                                <div className="mt-2 text-sm text-stone-500">
                                    {feature.description}
                                </div>
                                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                                    <div>
                                        <dt className="font-medium text-stone-900">
                                            Entity
                                        </dt>
                                        <dd className="text-stone-600">
                                            {feature.entityName}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium text-stone-900">
                                            Collection
                                        </dt>
                                        <dd className="text-stone-600">
                                            {feature.collectionName}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium text-stone-900">
                                            Primary field
                                        </dt>
                                        <dd className="text-stone-600">
                                            {feature.primaryField}
                                        </dd>
                                    </div>
                                </dl>

                                <div className="mt-4">
                                    <div className="text-sm font-medium text-stone-900">
                                        Fields
                                    </div>
                                    <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                        {sortedFields.map(([fieldName, field]) => (
                                            <div
                                                key={fieldName}
                                                className="border border-stone-300 bg-stone-50 p-2 text-sm"
                                            >
                                                <div className="font-medium text-stone-900">
                                                    {field.label} · {field.type}
                                                </div>
                                                <div className="text-stone-500">
                                                    {field.description}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <aside className="grid gap-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
                    <div className={contentCardClass}>
                        <div>
                            <div className="text-sm font-medium text-stone-900">
                                Chat
                            </div>
                            <div className="mt-1 text-sm text-stone-500">
                                Kept visible on the right so you can keep prompting while inspecting the generated app.
                            </div>
                        </div>

                        <Field
                            className="mt-4"
                            label="App prompt"
                            hint="Example: create a todo app"
                        >
                            <TextArea
                                rows={6}
                                className="min-h-36 resize-y"
                                value={featurePrompt}
                                onChange={(event) =>
                                    setFeaturePrompt(event.target.value)
                                }
                            />
                        </Field>

                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <Button
                                variant="subtle"
                                onClick={() => void handleResetRuntime()}
                                disabled={isGeneratingFeature || isHydratingRuntime}
                            >
                                Reset runtime
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => void handleGenerateFeature()}
                                disabled={isGeneratingFeature}
                            >
                                {isGeneratingFeature
                                    ? "Generating..."
                                    : "Generate feature"}
                            </Button>
                        </div>
                    </div>

                    <div className={contentCardClass}>
                        <Field
                            label="Follow-up prompt"
                            hint="Example: set the second todo to done"
                        >
                            <TextArea
                                rows={5}
                                className="min-h-28 resize-y"
                                value={followUpPrompt}
                                onChange={(event) =>
                                    setFollowUpPrompt(event.target.value)
                                }
                            />
                        </Field>

                        <div className="mt-3 flex justify-end">
                            <Button
                                variant="primary"
                                onClick={() => void handleApplyPrompt()}
                                disabled={!feature || isApplyingPrompt}
                            >
                                {isApplyingPrompt
                                    ? "Applying..."
                                    : "Apply prompt"}
                            </Button>
                        </div>
                    </div>

                    {featurePanel ? (
                        <div className={contentCardClass}>
                            <div className="text-sm font-medium text-stone-900">
                                Generation status
                            </div>
                            {featurePanel.summary ? (
                                <div className="mt-1 text-sm text-stone-500">
                                    {featurePanel.summary}
                                </div>
                            ) : null}
                            <Panel panel={featurePanel} />
                        </div>
                    ) : null}

                    {followUpPanel ? (
                        <div className={contentCardClass}>
                            <div className="text-sm font-medium text-stone-900">
                                Prompt status
                            </div>
                            {followUpPanel.summary ? (
                                <div className="mt-1 text-sm text-stone-500">
                                    {followUpPanel.summary}
                                </div>
                            ) : null}
                            <Panel panel={followUpPanel} />
                        </div>
                    ) : null}

                    <div className={contentCardClass}>
                        <div className="text-sm font-medium text-stone-900">
                            Prompt history
                        </div>
                        <div className="mt-1 text-sm text-stone-500">
                            Follow-up prompts stay visible here while you explore the runtime.
                        </div>
                        <div className="mt-3 grid gap-2">
                            {!feature ? (
                                <MessageCard message="Generate a feature to start the chat loop." />
                            ) : promptHistory.length === 0 ? (
                                <MessageCard message="No follow-up prompts applied yet." />
                            ) : (
                                promptHistory.map((entry, index) => (
                                    <StatusCard
                                        key={`${entry.at}-${index}`}
                                        tone="pass"
                                        label={entry.prompt}
                                        meta={formatDate(entry.at)}
                                        sections={[
                                            entry.summary,
                                            formatJson(entry.appliedPatches),
                                        ]}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </aside>
            </div>
        </section>
    )
}

function FeatureRuntimePreview({
    feature,
    entities,
    newEntityDraft,
    onDraftChange,
    onCreateEntity,
    onToggleEntityField,
    onRemoveEntity,
    onUpdateEntityField,
}: {
    feature: FeatureDefinition
    entities: Array<Record<string, unknown>>
    newEntityDraft: Record<string, string>
    onDraftChange: (field: string, value: string) => void
    onCreateEntity: () => void
    onToggleEntityField: (index: number, field: string) => void
    onRemoveEntity: (index: number) => void
    onUpdateEntityField: (index: number, field: string, value: unknown) => void
}) {
    const booleanFields = Object.entries(feature.fields).filter(
        ([, field]) => field.type === "boolean",
    )

    return (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <div className="border border-stone-300 bg-stone-50 p-4">
                <div className="text-sm font-medium text-stone-900">
                    Create {feature.entityName}
                </div>
                <div className="mt-3 grid gap-3">
                    {Object.entries(feature.fields).map(([fieldName, field]) => (
                        <Field
                            key={fieldName}
                            label={field.label}
                            hint={field.description}
                        >
                            {field.type === "boolean" ? (
                                <select
                                    className="w-full border border-stone-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400"
                                    value={newEntityDraft[fieldName] ?? "false"}
                                    onChange={(event) =>
                                        onDraftChange(fieldName, event.target.value)
                                    }
                                >
                                    <option value="false">false</option>
                                    <option value="true">true</option>
                                </select>
                            ) : (
                                <TextInput
                                    type={field.type === "number" ? "number" : "text"}
                                    value={newEntityDraft[fieldName] ?? ""}
                                    placeholder={field.label}
                                    onChange={(event) =>
                                        onDraftChange(fieldName, event.target.value)
                                    }
                                />
                            )}
                        </Field>
                    ))}
                </div>
                <div className="mt-4 flex justify-end">
                    <Button variant="primary" onClick={onCreateEntity}>
                        Add {feature.entityName}
                    </Button>
                </div>
            </div>

            <div className="border border-stone-300 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-sm font-medium text-stone-900">
                            {feature.collectionName}
                        </div>
                        <div className="text-sm text-stone-500">
                            Live state from the Zustand runtime.
                        </div>
                    </div>
                    <div className="text-sm text-stone-500">
                        {entities.length} item{entities.length === 1 ? "" : "s"}
                    </div>
                </div>

                <div className="mt-4 grid gap-3">
                    {entities.length === 0 ? (
                        <MessageCard message={`No ${feature.collectionName} yet.`} />
                    ) : (
                        entities.map((entity, index) => {
                            const primaryValue = entity[feature.primaryField]

                            return (
                                <div
                                    key={`${feature.collectionName}-${index}`}
                                    className="border border-stone-300 bg-stone-50 p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-medium text-stone-900">
                                                {String(primaryValue ?? `${feature.entityName} ${index + 1}`)}
                                            </div>
                                            {feature.statusField ? (
                                                <div className="mt-1 text-sm text-stone-500">
                                                    {feature.statusField}: {String(entity[feature.statusField])}
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="flex gap-2">
                                            {booleanFields.map(([fieldName, field]) => (
                                                <Button
                                                    key={fieldName}
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() =>
                                                        onToggleEntityField(index, fieldName)
                                                    }
                                                >
                                                    {field.label}
                                                </Button>
                                            ))}
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={() => onRemoveEntity(index)}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        {Object.entries(feature.fields).map(
                                            ([fieldName, field]) => (
                                                <Field
                                                    key={fieldName}
                                                    label={field.label}
                                                    hint={field.type}
                                                >
                                                    {field.type === "boolean" ? (
                                                        <select
                                                            className="w-full border border-stone-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400"
                                                            value={String(entity[fieldName] ?? false)}
                                                            onChange={(event) =>
                                                                onUpdateEntityField(
                                                                    index,
                                                                    fieldName,
                                                                    event.target.value ===
                                                                        "true",
                                                                )
                                                            }
                                                        >
                                                            <option value="true">true</option>
                                                            <option value="false">false</option>
                                                        </select>
                                                    ) : (
                                                        <TextInput
                                                            type={
                                                                field.type === "number"
                                                                    ? "number"
                                                                    : "text"
                                                            }
                                                            value={String(entity[fieldName] ?? "")}
                                                            onChange={(event) =>
                                                                onUpdateEntityField(
                                                                    index,
                                                                    fieldName,
                                                                    field.type ===
                                                                        "number"
                                                                        ? Number(
                                                                              event
                                                                                  .target
                                                                                  .value,
                                                                          )
                                                                        : event
                                                                              .target
                                                                              .value,
                                                                )
                                                            }
                                                        />
                                                    )}
                                                </Field>
                                            ),
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}

function buildInitialEntityDraft(feature: FeatureDefinition): Record<string, string> {
    const next: Record<string, string> = {}

    for (const [fieldName, field] of Object.entries(feature.fields)) {
        next[fieldName] = field.type === "boolean" ? "false" : ""
    }

    return next
}

function materializeEntity(
    feature: FeatureDefinition,
    draft: Record<string, string>,
): Record<string, unknown> {
    const entity: Record<string, unknown> = {}

    for (const [fieldName, field] of Object.entries(feature.fields)) {
        const rawValue = draft[fieldName] ?? ""
        if (field.type === "number") {
            entity[fieldName] = rawValue.trim() ? Number(rawValue) : 0
        } else if (field.type === "boolean") {
            entity[fieldName] = rawValue === "true"
        } else {
            entity[fieldName] = rawValue
        }
    }

    if (!feature.primaryField || entity[feature.primaryField]) {
        return entity
    }

    entity[feature.primaryField] = `${feature.entityName} ${Math.random().toString(36).slice(2, 7)}`
    return entity
}
