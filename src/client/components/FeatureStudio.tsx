import { useEffect, useMemo, useState } from "react"
import { describeError, fetchJson, jsonRequest } from "../api"
import { useGeneratedAppStore } from "../generatedAppStore"
import { formatDate, formatJson } from "../tool-utils"
import type {
    ApplyFeaturePromptResponse,
    FeatureDefinition,
    FeaturePromptHistoryEntry,
    FeatureRuntimeResponse,
    GenerateFeatureResponse,
} from "../types"
import {
    ErrorCard,
    MessageCard,
    StatusCard,
    type FeedbackTone,
} from "./Feedback"
import {
    Button,
    Field,
    TextArea,
    TextInput,
    contentCardClass,
} from "./Primitives"

type StudioFeedback =
    | {
          kind: "message"
          summary?: string
          tone?: FeedbackTone
          message: string
      }
    | {
          kind: "status"
          summary?: string
          tone: "pass" | "fail"
          label: string
          meta: string
          sections: string[]
      }
    | ({
          kind: "error"
      } & ReturnType<typeof describeError>)

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
    const [featurePrompt, setFeaturePrompt] = useState("")
    const [followUpPrompt, setFollowUpPrompt] = useState("")
    const [featureFeedback, setFeatureFeedback] =
        useState<StudioFeedback | null>(null)
    const [followUpFeedback, setFollowUpFeedback] =
        useState<StudioFeedback | null>(null)
    const [isGeneratingFeature, setIsGeneratingFeature] = useState(false)
    const [isApplyingPrompt, setIsApplyingPrompt] = useState(false)
    const [isHydratingRuntime, setIsHydratingRuntime] = useState(true)
    const [newEntityDraft, setNewEntityDraft] = useState<
        Record<string, string>
    >({})

    const sortedFields = useMemo(
        () =>
            feature
                ? Object.entries(feature.fields).sort(([left], [right]) =>
                      left.localeCompare(right),
                  )
                : [],
        [feature],
    )

    const orderedPromptHistory = useMemo(
        () => [...promptHistory].reverse(),
        [promptHistory],
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
                setNewEntityDraft(
                    buildInitialEntityDraft(result.runtime.feature),
                )
            }
        } catch (error) {
            setFeatureFeedback({
                kind: "error",
                ...describeError(
                    error,
                    "Unable to load persisted feature runtime.",
                ),
            })
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
            setFeatureFeedback({
                kind: "message",
                tone: "fail",
                message: "Describe the app or feature you want to create.",
            })
            return
        }

        setIsGeneratingFeature(true)
        setFeatureFeedback({
            kind: "message",
            tone: "warn",
            message:
                "Workers AI is planning the shared model, actions, and views...",
        })

        try {
            const result = await fetchJson<GenerateFeatureResponse>(
                "/api/features/generate",
                jsonRequest("POST", { description }),
            )
            setFeature(result.feature)
            await persistRuntime()
            setFeatureFeedback({
                kind: "message",
                tone: "pass",
                summary: result.feature.name,
                message: `Generated ${result.feature.collectionName} with ${Object.keys(result.feature.fields).length} fields and ${result.feature.actions.length} actions.`,
            })
            setFeaturePrompt("")
            setFollowUpFeedback(null)
            setNewEntityDraft(buildInitialEntityDraft(result.feature))
        } catch (error) {
            setFeatureFeedback({ kind: "error", ...describeError(error) })
        } finally {
            setIsGeneratingFeature(false)
        }
    }

    async function handleApplyPrompt(): Promise<void> {
        if (!feature) {
            setFollowUpFeedback({
                kind: "message",
                tone: "fail",
                message: "Generate a feature first.",
            })
            return
        }

        const prompt = followUpPrompt.trim()
        if (!prompt) {
            setFollowUpFeedback({
                kind: "message",
                tone: "fail",
                message: "Describe the state change you want to make.",
            })
            return
        }

        setIsApplyingPrompt(true)
        setFollowUpFeedback({
            kind: "message",
            tone: "warn",
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
            setFollowUpPrompt("")
            setFollowUpFeedback(null)
        } catch (error) {
            setFollowUpFeedback({ kind: "error", ...describeError(error) })
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
        setFollowUpFeedback({
            kind: "message",
            tone: "pass",
            summary: "State updated.",
            message: `Added a new ${feature.entityName.toLowerCase()} to the Zustand runtime.`,
        })
    }

    async function handleResetRuntime(): Promise<void> {
        reset()
        setFeaturePrompt("")
        setFollowUpPrompt("")
        setNewEntityDraft({})
        setFollowUpFeedback(null)
        try {
            await clearPersistedRuntime()
            setFeatureFeedback({
                kind: "message",
                tone: "pass",
                message:
                    "Cleared the persisted feature runtime and reset the local Zustand store.",
            })
        } catch (error) {
            setFeatureFeedback({
                kind: "error",
                ...describeError(
                    error,
                    "Unable to clear persisted feature runtime.",
                ),
            })
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
        <section className="flex min-w-0 flex-col bg-white">
            <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="grid min-w-0 gap-4">
                    <div className={contentCardClass}>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-medium text-stone-900">
                                    Live app runtime
                                </div>
                                <div className="text-sm text-stone-500">
                                    Trusted rendering of generated feature
                                    definitions.
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
                                    void handleUpdateEntityField(
                                        index,
                                        field,
                                        value,
                                    )
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
                                        {sortedFields.map(
                                            ([fieldName, field]) => (
                                                <div
                                                    key={fieldName}
                                                    className="border border-stone-300 bg-stone-50 p-2 text-sm"
                                                >
                                                    <div className="font-medium text-stone-900">
                                                        {field.label} ·{" "}
                                                        {field.type}
                                                    </div>
                                                    <div className="text-stone-500">
                                                        {field.description}
                                                    </div>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <aside className="grid gap-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
                    <div className={contentCardClass}>
                        <Field
                            className="mt-4"
                            label="App prompt"
                            hint="Example: create a todo app"
                        >
                            <TextArea
                                rows={6}
                                className="min-h-36 resize-y"
                                value={featurePrompt}
                                placeholder="Create a todo app"
                                onChange={(event) =>
                                    setFeaturePrompt(event.target.value)
                                }
                            />
                        </Field>

                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <Button
                                variant="subtle"
                                onClick={() => void handleResetRuntime()}
                                disabled={
                                    isGeneratingFeature || isHydratingRuntime
                                }
                            >
                                Clear all
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

                    {featureFeedback ? (
                        <div className={contentCardClass}>
                            <div className="text-sm font-medium text-stone-900">
                                Generation status
                            </div>
                            {featureFeedback.summary ? (
                                <div className="mt-1 text-sm text-stone-500">
                                    {featureFeedback.summary}
                                </div>
                            ) : null}
                            <div className="mt-3">
                                {renderFeedback(featureFeedback)}
                            </div>
                        </div>
                    ) : null}

                    <div className={contentCardClass}>
                        <div className="text-sm font-medium text-stone-900">
                            Follow-up chat
                        </div>

                        <div className="mt-4 grid max-h-[32rem] gap-3 overflow-y-auto pr-1">
                            {!feature ? (
                                <MessageCard message="Generate a feature to start the chat loop." />
                            ) : (
                                <>
                                    {orderedPromptHistory.length === 0 &&
                                    !followUpFeedback ? (
                                        <MessageCard message="No follow-up prompts applied yet." />
                                    ) : null}

                                    {orderedPromptHistory.map(
                                        (entry, index) => (
                                            <FollowUpExchange
                                                key={`${entry.at}-${index}`}
                                                entry={entry}
                                            />
                                        ),
                                    )}

                                    {followUpFeedback ? (
                                        <FollowUpActivity
                                            feedback={followUpFeedback}
                                        />
                                    ) : null}
                                </>
                            )}
                        </div>

                        <Field
                            className="mt-4"
                            label="Your next prompt"
                            hint="Example: set the second todo to done"
                        >
                            <TextArea
                                rows={5}
                                className="min-h-28 resize-y"
                                value={followUpPrompt}
                                placeholder="Set the second todo to done"
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
                </aside>
            </div>
        </section>
    )
}

function renderFeedback(feedback: StudioFeedback) {
    if (feedback.kind === "message") {
        return <MessageCard message={feedback.message} tone={feedback.tone} />
    }

    if (feedback.kind === "status") {
        return (
            <StatusCard
                tone={feedback.tone}
                label={feedback.label}
                meta={feedback.meta}
                sections={feedback.sections}
            />
        )
    }

    return (
        <ErrorCard
            message={feedback.message}
            prominentSections={feedback.prominentSections}
            details={feedback.details}
        />
    )
}

function FollowUpExchange({ entry }: { entry: FeaturePromptHistoryEntry }) {
    return (
        <div className="grid gap-2">
            <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-stone-900 px-4 py-3 text-sm text-white">
                    <div className="whitespace-pre-wrap break-words leading-6">
                        {entry.prompt}
                    </div>
                    <div className="mt-2 text-xs text-stone-300">
                        {formatDate(entry.at)}
                    </div>
                </div>
            </div>

            <div className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-stone-300 bg-stone-50 p-3 text-sm text-stone-800">
                    <div className="whitespace-pre-wrap break-words leading-6">
                        {entry.summary}
                    </div>
                    <details className="mt-3">
                        <summary className="cursor-pointer font-medium text-stone-700">
                            Generated patch JSON
                        </summary>
                        <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words border border-stone-300 bg-white p-3 font-mono text-sm leading-6 text-zinc-900">
                            {formatJson(entry.appliedPatches)}
                        </pre>
                    </details>
                </div>
            </div>
        </div>
    )
}

function FollowUpActivity({ feedback }: { feedback: StudioFeedback }) {
    if (feedback.kind === "error") {
        return (
            <div className="flex justify-start">
                <div className="max-w-[92%]">
                    <ErrorCard
                        message={feedback.message}
                        prominentSections={feedback.prominentSections}
                        details={feedback.details}
                    />
                </div>
            </div>
        )
    }

    if (feedback.kind === "status") {
        return (
            <div className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">
                    <div className="flex items-center justify-between gap-3 font-medium text-emerald-700">
                        <span>{feedback.label}</span>
                        <span className="text-xs">{feedback.meta}</span>
                    </div>
                    {feedback.sections[0] ? (
                        <div className="mt-2 whitespace-pre-wrap break-words leading-6">
                            {feedback.sections[0]}
                        </div>
                    ) : null}
                    {feedback.sections[1] ? (
                        <details className="mt-3">
                            <summary className="cursor-pointer font-medium text-emerald-800">
                                Generated patch JSON
                            </summary>
                            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words border border-emerald-200 bg-white p-3 font-mono text-sm leading-6 text-zinc-900">
                                {feedback.sections[1]}
                            </pre>
                        </details>
                    ) : null}
                </div>
            </div>
        )
    }

    return (
        <div className="flex justify-start">
            <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-stone-300 bg-stone-50 p-3 text-sm leading-6 text-stone-800">
                {feedback.message}
            </div>
        </div>
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
                    {Object.entries(feature.fields).map(
                        ([fieldName, field]) => (
                            <Field
                                key={fieldName}
                                label={field.label}
                                hint={field.description}
                            >
                                {field.type === "boolean" ? (
                                    <select
                                        className="w-full border border-stone-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400"
                                        value={
                                            newEntityDraft[fieldName] ?? "false"
                                        }
                                        onChange={(event) =>
                                            onDraftChange(
                                                fieldName,
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="false">false</option>
                                        <option value="true">true</option>
                                    </select>
                                ) : (
                                    <TextInput
                                        type={
                                            field.type === "number"
                                                ? "number"
                                                : "text"
                                        }
                                        value={newEntityDraft[fieldName] ?? ""}
                                        placeholder={field.label}
                                        onChange={(event) =>
                                            onDraftChange(
                                                fieldName,
                                                event.target.value,
                                            )
                                        }
                                    />
                                )}
                            </Field>
                        ),
                    )}
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
                    </div>
                    <div className="text-sm text-stone-500">
                        {entities.length} item{entities.length === 1 ? "" : "s"}
                    </div>
                </div>

                <div className="mt-4 grid gap-3">
                    {entities.length === 0 ? (
                        <MessageCard
                            message={`No ${feature.collectionName} yet.`}
                        />
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
                                                {String(
                                                    primaryValue ??
                                                        `${feature.entityName} ${index + 1}`,
                                                )}
                                            </div>
                                            {feature.statusField ? (
                                                <div className="mt-1 text-sm text-stone-500">
                                                    {feature.statusField}:{" "}
                                                    {String(
                                                        entity[
                                                            feature.statusField
                                                        ],
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="flex gap-2">
                                            {booleanFields.map(
                                                ([fieldName, field]) => (
                                                    <Button
                                                        key={fieldName}
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() =>
                                                            onToggleEntityField(
                                                                index,
                                                                fieldName,
                                                            )
                                                        }
                                                    >
                                                        {field.label}
                                                    </Button>
                                                ),
                                            )}
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={() =>
                                                    onRemoveEntity(index)
                                                }
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
                                                    {field.type ===
                                                    "boolean" ? (
                                                        <select
                                                            className="w-full border border-stone-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400"
                                                            value={String(
                                                                entity[
                                                                    fieldName
                                                                ] ?? false,
                                                            )}
                                                            onChange={(event) =>
                                                                onUpdateEntityField(
                                                                    index,
                                                                    fieldName,
                                                                    event.target
                                                                        .value ===
                                                                        "true",
                                                                )
                                                            }
                                                        >
                                                            <option value="true">
                                                                true
                                                            </option>
                                                            <option value="false">
                                                                false
                                                            </option>
                                                        </select>
                                                    ) : (
                                                        <TextInput
                                                            type={
                                                                field.type ===
                                                                "number"
                                                                    ? "number"
                                                                    : "text"
                                                            }
                                                            value={String(
                                                                entity[
                                                                    fieldName
                                                                ] ?? "",
                                                            )}
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

function buildInitialEntityDraft(
    feature: FeatureDefinition,
): Record<string, string> {
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

    entity[feature.primaryField] =
        `${feature.entityName} ${Math.random().toString(36).slice(2, 7)}`
    return entity
}
