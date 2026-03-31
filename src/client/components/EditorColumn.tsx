import { twMerge } from "tailwind-merge"
import { BLANK_TOOL, type PanelState, type ToolDefinition } from "../types"
import { MessageCard, Panel } from "./Panel"
import {
    Button,
    Field,
    TextArea,
    TextInput,
    panelSurfaceClass,
} from "./Primitives"

interface EditorColumnProps {
    panelRef: (node: HTMLElement | null) => void
    currentTool: ToolDefinition | null
    deletingToolName: string | null
    editorDraft: ToolDefinition
    editorPanel: PanelState | null
    isSaving: boolean
    onDraftChange: (changes: Partial<ToolDefinition>) => void
    onSaveTool: () => void
    onDeleteTool: () => void
}

export function EditorColumn({
    panelRef,
    currentTool,
    deletingToolName,
    editorDraft,
    editorPanel,
    isSaving,
    onDraftChange,
    onSaveTool,
    onDeleteTool,
}: EditorColumnProps) {
    const showEmptyState = !currentTool && isBlankEditorDraft(editorDraft)

    return (
        <section
            className={twMerge(panelSurfaceClass, "p-4")}
            id="editor-panel"
            ref={(node) => {
                panelRef(node)
            }}
        >
            <div className="flex items-center justify-between gap-3 border-b border-stone-300 pb-3">
                <h2 className="text-lg font-semibold text-stone-900">Editor</h2>
                <div className="flex gap-2">
                    <Button
                        variant="danger"
                        onClick={onDeleteTool}
                        disabled={!currentTool || deletingToolName !== null}
                    >
                        Delete
                    </Button>
                    <Button
                        variant="primary"
                        onClick={onSaveTool}
                        disabled={isSaving || showEmptyState}
                    >
                        Save
                    </Button>
                </div>
            </div>

            {showEmptyState ? (
                <section className="flex grow flex-col justify-center pt-4">
                    <MessageCard message="Select a tool from the registry or generate a new one to start editing." />
                </section>
            ) : (
                <>
                    <section className="flex min-h-0 grow flex-col gap-4 pt-4">
                        <Field label="Name">
                            <TextInput
                                type="text"
                                placeholder="Tool name"
                                value={editorDraft.name}
                                onChange={(event) =>
                                    onDraftChange({ name: event.target.value })
                                }
                            />
                        </Field>

                        <Field label="Description">
                            <TextArea
                                rows={4}
                                className="min-h-32 resize-y"
                                value={editorDraft.description}
                                onChange={(event) =>
                                    onDraftChange({
                                        description: event.target.value,
                                    })
                                }
                            />
                        </Field>

                        <Field label="Input schema">
                            <TextArea
                                rows={6}
                                className="min-h-44 resize-y"
                                spellCheck={false}
                                value={editorDraft.inputSchemaSource}
                                onChange={(event) =>
                                    onDraftChange({
                                        inputSchemaSource: event.target.value,
                                    })
                                }
                            />
                        </Field>

                        <Field label="Example input">
                            <TextArea
                                rows={5}
                                className="min-h-40 resize-y"
                                spellCheck={false}
                                value={editorDraft.exampleInput}
                                onChange={(event) =>
                                    onDraftChange({
                                        exampleInput: event.target.value,
                                    })
                                }
                            />
                        </Field>

                        <Field label="Execute source" className="grow">
                            <TextArea
                                className="min-h-72 grow resize-y"
                                spellCheck={false}
                                value={editorDraft.executeSource}
                                onChange={(event) =>
                                    onDraftChange({
                                        executeSource: event.target.value,
                                    })
                                }
                            />
                        </Field>
                    </section>

                    {editorPanel ? (
                        <section className="mt-4 border-t border-stone-300 pt-4">
                            <div className="text-sm font-medium text-stone-900">
                                Status
                            </div>
                            {editorPanel.summary ? (
                                <div className="mt-1 text-sm text-stone-500">
                                    {editorPanel.summary}
                                </div>
                            ) : null}
                            <Panel panel={editorPanel} />
                        </section>
                    ) : null}
                </>
            )}
        </section>
    )
}

function isBlankEditorDraft(tool: ToolDefinition): boolean {
    return (
        tool.name === BLANK_TOOL.name &&
        tool.description === BLANK_TOOL.description &&
        tool.inputSchemaSource === BLANK_TOOL.inputSchemaSource &&
        tool.exampleInput === BLANK_TOOL.exampleInput &&
        tool.executeSource === BLANK_TOOL.executeSource
    )
}
