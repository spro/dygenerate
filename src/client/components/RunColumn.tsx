import { twMerge } from "tailwind-merge"
import { formatDate, formatJson } from "../tool-utils"
import type {
    ActiveTab,
    InputFieldChip,
    PanelState,
    RunHistoryEntry,
    ToolDefinition,
} from "../types"
import { MessageCard, Panel, StatusCard } from "./Panel"
import {
    Button,
    TabButton,
    TextArea,
    codeBlockClass,
    contentCardClass,
    panelSurfaceClass,
} from "./Primitives"

interface RunColumnProps {
    selectedTool: ToolDefinition | null
    activeTab: ActiveTab
    inputFields: InputFieldChip[]
    runInput: string
    selectedToolHistory: RunHistoryEntry[]
    resultsPanel: PanelState | null
    isRunning: boolean
    onActiveTabChange: (tab: ActiveTab) => void
    onRunInputChange: (value: string) => void
    onLoadExample: () => void
    onRunTool: () => void
    onScrollToEditor: () => void
}

const TABS: ActiveTab[] = ["run", "schema", "history"]

export function RunColumn({
    selectedTool,
    activeTab,
    inputFields,
    runInput,
    selectedToolHistory,
    resultsPanel,
    isRunning,
    onActiveTabChange,
    onRunInputChange,
    onLoadExample,
    onRunTool,
    onScrollToEditor,
}: RunColumnProps) {
    return (
        <section className={twMerge(panelSurfaceClass, "p-4")}>
            <div className="flex items-start justify-between gap-3 border-b border-stone-300 pb-3">
                <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-stone-900">
                        {selectedTool?.name ?? "No tool selected"}
                    </h2>
                    {selectedTool?.description ? (
                        <div className="mt-1 text-sm text-stone-500">
                            {selectedTool.description}
                        </div>
                    ) : null}
                </div>
                <Button variant="ghost" onClick={onScrollToEditor}>
                    Edit
                </Button>
            </div>

            <div className="mt-3 flex items-center gap-3 border-b border-stone-300 pb-3 text-sm text-stone-500">
                <span>
                    {selectedTool?.updatedAt
                        ? `Updated ${formatDate(selectedTool.updatedAt)}`
                        : "Unsaved"}
                </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1 border-b border-stone-300 pb-3">
                {TABS.map((tab) => (
                    <TabButton
                        key={tab}
                        active={activeTab === tab}
                        onClick={() => onActiveTabChange(tab)}
                    >
                        {tab === "run"
                            ? "Run"
                            : tab === "schema"
                              ? "Schema"
                              : "History"}
                    </TabButton>
                ))}
            </div>

            {activeTab === "run" ? (
                <section className="flex flex-col gap-4 pt-4">
                    <div className={contentCardClass}>
                        <div className="text-sm font-medium text-stone-900">
                            Fields
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-600">
                            {inputFields.length === 0 ? (
                                <span>none</span>
                            ) : (
                                inputFields.map((field) => (
                                    <span
                                        key={`${field.name}-${field.type}`}
                                        className="border border-stone-300 px-2 py-1"
                                    >
                                        {field.name} {field.type}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>

                    <div className={contentCardClass}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-stone-900">
                                Input
                            </div>
                            <Button variant="secondary" onClick={onLoadExample}>
                                Use example
                            </Button>
                        </div>
                        <TextArea
                            className="min-h-56 resize-y"
                            value={runInput}
                            spellCheck={false}
                            aria-label="Tool input editor"
                            onChange={(event) =>
                                onRunInputChange(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (
                                    (event.metaKey || event.ctrlKey) &&
                                    event.key === "Enter"
                                ) {
                                    event.preventDefault()
                                    onRunTool()
                                }
                            }}
                        />
                    </div>

                    {resultsPanel ? (
                        <div className={contentCardClass}>
                            <div className="text-sm font-medium text-stone-900">
                                Result
                            </div>
                            {resultsPanel.summary ? (
                                <div className="mt-1 text-sm text-stone-500">
                                    {resultsPanel.summary}
                                </div>
                            ) : null}
                            <Panel panel={resultsPanel} />
                        </div>
                    ) : null}
                </section>
            ) : null}

            {activeTab === "schema" ? (
                <section className="flex flex-col gap-4 pt-4">
                    <div className={contentCardClass}>
                        <div className="mb-2 text-sm font-medium text-stone-900">
                            Input schema
                        </div>
                        <pre className={codeBlockClass}>
                            {selectedTool?.inputSchemaSource ||
                                "No tool selected."}
                        </pre>
                    </div>
                    <div className={contentCardClass}>
                        <div className="mb-2 text-sm font-medium text-stone-900">
                            Example input
                        </div>
                        <pre className={codeBlockClass}>
                            {selectedTool?.exampleInput || "{}"}
                        </pre>
                    </div>
                </section>
            ) : null}

            {activeTab === "history" ? (
                <section className="pt-4">
                    <div className={contentCardClass}>
                        <div className="mb-2 text-sm font-medium text-stone-900">
                            History
                        </div>
                        <div className="grid gap-2.5">
                            {!selectedTool ? (
                                <MessageCard message="No tool selected." />
                            ) : selectedToolHistory.length === 0 ? (
                                <MessageCard message="No runs yet." />
                            ) : (
                                selectedToolHistory.map((entry, index) => (
                                    <RunHistoryCard
                                        key={`${entry.at}-${index}`}
                                        entry={entry}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </section>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 border-t border-stone-300 pt-4 sm:flex-row sm:justify-end">
                <Button
                    variant="primary"
                    className="w-full sm:w-auto"
                    onClick={onRunTool}
                    disabled={!selectedTool || isRunning}
                >
                    Run tool
                </Button>
            </div>
        </section>
    )
}

function RunHistoryCard({ entry }: { entry: RunHistoryEntry }) {
    return (
        <StatusCard
            tone={entry.status === "success" ? "pass" : "fail"}
            label={entry.status === "success" ? "Success" : "Failed"}
            meta={`${formatDate(entry.at)}${entry.durationMs !== undefined ? ` · ${entry.durationMs}ms` : ""}`}
            sections={
                entry.status === "success"
                    ? [formatJson(entry.input), formatJson(entry.output)]
                    : [formatJson(entry.input), entry.message ?? "Run failed."]
            }
        />
    )
}
