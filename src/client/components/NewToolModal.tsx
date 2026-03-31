import { twMerge } from "tailwind-merge"
import type { PanelState, ToolDefinition } from "../types"
import { Panel } from "./Panel"
import {
    Button,
    Field,
    TextArea,
    TextInput,
    panelSurfaceClass,
} from "./Primitives"

interface NewToolModalProps {
    isOpen: boolean
    description: string
    draft: ToolDefinition | null
    panel: PanelState | null
    isGenerating: boolean
    isSaving: boolean
    onDescriptionChange: (value: string) => void
    onDraftChange: (changes: Partial<ToolDefinition>) => void
    onGenerate: () => void
    onSave: () => void
    onClose: () => void
}

export function NewToolModal({
    isOpen,
    description,
    draft,
    panel,
    isGenerating,
    isSaving,
    onDescriptionChange,
    onDraftChange,
    onGenerate,
    onSave,
    onClose,
}: NewToolModalProps) {
    if (!isOpen) {
        return null
    }

    const busy = isGenerating || isSaving

    return (
        <div
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-3"
            role="presentation"
            onClick={() => {
                if (!busy) {
                    onClose()
                }
            }}
        >
            <section
                className={twMerge(
                    panelSurfaceClass,
                    "max-h-[90vh] w-full max-w-3xl gap-4 overflow-auto p-4",
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-tool-modal-title"
                onClick={(event) => {
                    event.stopPropagation()
                }}
            >
                <div className="flex items-center justify-between gap-3 border-b border-stone-300 pb-3">
                    <h2
                        id="new-tool-modal-title"
                        className="text-lg font-semibold text-stone-900"
                    >
                        New tool
                    </h2>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={busy}
                    >
                        Close
                    </Button>
                </div>

                <Field label="Prompt">
                    <TextArea
                        value={description}
                        rows={draft ? 3 : 7}
                        className={
                            draft ? "min-h-20 resize-y" : "min-h-52 resize-y"
                        }
                        placeholder="Describe the tool to generate."
                        onChange={(event) =>
                            onDescriptionChange(event.target.value)
                        }
                    />
                </Field>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={busy}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant={draft ? "secondary" : "primary"}
                        onClick={onGenerate}
                        disabled={busy}
                    >
                        {draft ? "Regenerate" : "Generate"}
                    </Button>
                    {draft ? (
                        <Button
                            variant="primary"
                            onClick={onSave}
                            disabled={busy}
                        >
                            Save
                        </Button>
                    ) : null}
                </div>

                {draft ? (
                    <section className="flex flex-col gap-4 border-t border-stone-300 pt-4">
                        <Field label="Name">
                            <TextInput
                                type="text"
                                placeholder="Tool name"
                                value={draft.name}
                                onChange={(event) =>
                                    onDraftChange({ name: event.target.value })
                                }
                            />
                        </Field>

                        <Field label="Description">
                            <TextArea
                                rows={3}
                                className="min-h-20 resize-y"
                                value={draft.description}
                                onChange={(event) =>
                                    onDraftChange({
                                        description: event.target.value,
                                    })
                                }
                            />
                        </Field>

                        <Field label="Input schema">
                            <TextArea
                                rows={5}
                                className="min-h-36 resize-y"
                                spellCheck={false}
                                value={draft.inputSchemaSource}
                                onChange={(event) =>
                                    onDraftChange({
                                        inputSchemaSource: event.target.value,
                                    })
                                }
                            />
                        </Field>

                        <Field label="Example input">
                            <TextArea
                                rows={4}
                                className="min-h-28 resize-y"
                                spellCheck={false}
                                value={draft.exampleInput}
                                onChange={(event) =>
                                    onDraftChange({
                                        exampleInput: event.target.value,
                                    })
                                }
                            />
                        </Field>

                        <Field label="Execute source">
                            <TextArea
                                rows={8}
                                className="min-h-52 resize-y"
                                spellCheck={false}
                                value={draft.executeSource}
                                onChange={(event) =>
                                    onDraftChange({
                                        executeSource: event.target.value,
                                    })
                                }
                            />
                        </Field>
                    </section>
                ) : null}

                {panel ? (
                    <section className="border-t border-stone-300 pt-4">
                        <div className="text-sm font-medium text-stone-900">
                            Status
                        </div>
                        {panel.summary ? (
                            <div className="mt-1 text-sm text-stone-500">
                                {panel.summary}
                            </div>
                        ) : null}
                        <Panel panel={panel} />
                    </section>
                ) : null}
            </section>
        </div>
    )
}
