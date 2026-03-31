import { useRef } from "react"
import { AppHeader } from "./components/AppHeader"
import { EditorColumn } from "./components/EditorColumn"
import { NewToolModal } from "./components/NewToolModal"
import { RegistrySidebar } from "./components/RegistrySidebar"
import { RunColumn } from "./components/RunColumn"
import { useToolWorkbench } from "./useToolWorkbench"

export default function App() {
    const editorPanelRef = useRef<HTMLElement | null>(null)
    const {
        activeTab,
        busyActions,
        closeNewToolModal,
        currentHistory,
        currentTool,
        currentToolName,
        deletingToolName,
        editorDraft,
        editorPanel,
        generationDescription,
        handleClearTools,
        handleDeleteToolFromEditor,
        handleGenerateTool,
        handleLoadExample,
        handleNewTool,
        handleRunTool,
        handleSaveNewTool,
        handleSaveTool,
        handleSeedTools,
        inputFields,
        isNewToolModalOpen,
        loadTool,
        newToolDraft,
        newToolPanel,
        updateNewToolDraft,
        resultsPanel,
        runInput,
        setActiveTab,
        setGenerationDescription,
        setRunInput,
        tools,
        updateEditorDraft,
    } = useToolWorkbench()

    function scrollToEditor(): void {
        editorPanelRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        })
    }

    return (
        <div className="min-h-screen bg-stone-50 text-zinc-900">
            <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col">
                <AppHeader
                    toolCount={tools.length}
                    isClearing={busyActions.clear}
                    isSeeding={busyActions.seed}
                    onClearAll={() => void handleClearTools()}
                    onSeedSamples={() => void handleSeedTools()}
                    onNewTool={handleNewTool}
                />

                <main className="grid flex-1 grid-cols-1 gap-0 md:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(360px,1fr)_minmax(420px,1fr)]">
                    <RegistrySidebar
                        tools={tools}
                        currentToolName={currentToolName}
                        onSelectTool={(name) => void loadTool(name)}
                    />

                    <RunColumn
                        currentTool={currentTool}
                        activeTab={activeTab}
                        inputFields={inputFields}
                        runInput={runInput}
                        currentHistory={currentHistory}
                        resultsPanel={resultsPanel}
                        isRunning={busyActions.run}
                        onSetActiveTab={setActiveTab}
                        onRunInputChange={setRunInput}
                        onLoadExample={handleLoadExample}
                        onRunTool={() => void handleRunTool()}
                        onScrollToEditor={scrollToEditor}
                    />

                    <EditorColumn
                        panelRef={(node) => {
                            editorPanelRef.current = node
                        }}
                        currentTool={currentTool}
                        deletingToolName={deletingToolName}
                        editorDraft={editorDraft}
                        editorPanel={editorPanel}
                        isSaving={busyActions.save}
                        onDraftChange={updateEditorDraft}
                        onSaveTool={() => void handleSaveTool()}
                        onDeleteTool={() => void handleDeleteToolFromEditor()}
                    />
                </main>
            </div>

            <NewToolModal
                isOpen={isNewToolModalOpen}
                description={generationDescription}
                draft={newToolDraft}
                panel={newToolPanel}
                isGenerating={busyActions.generate}
                isSaving={busyActions.save}
                onDescriptionChange={setGenerationDescription}
                onDraftChange={updateNewToolDraft}
                onGenerate={() => void handleGenerateTool()}
                onSave={() => void handleSaveNewTool()}
                onClose={closeNewToolModal}
            />
        </div>
    )
}
