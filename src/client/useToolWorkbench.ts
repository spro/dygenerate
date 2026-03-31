import { useEffect, useMemo, useState } from "react"
import { createErrorPanel, fetchJson, jsonRequest } from "./api"
import { formatJson, inferInputFields, pushRunHistory } from "./tool-utils"
import {
    BLANK_TOOL,
    type ActiveTab,
    type ClearToolsResponse,
    type GenerateToolResponse,
    type PanelState,
    type RunHistoryEntry,
    type RunToolResponse,
    type SeedToolsResponse,
    type ToolDefinition,
    type ToolResponse,
    type ToolsListResponse,
    type ToolSummary,
} from "./types"

type BusyAction = "seed" | "clear" | "generate" | "save" | "run"

export function useToolWorkbench() {
    const [tools, setTools] = useState<ToolSummary[]>([])
    const [currentTool, setCurrentTool] = useState<ToolDefinition | null>(null)
    const [editorDraft, setEditorDraft] = useState<ToolDefinition>(() => ({
        ...BLANK_TOOL,
    }))
    const [generationDescription, setGenerationDescription] = useState("")
    const [isNewToolModalOpen, setIsNewToolModalOpen] = useState(false)
    const [newToolDraft, setNewToolDraft] = useState<ToolDefinition | null>(
        null,
    )
    const [newToolPanel, setNewToolPanel] = useState<PanelState | null>(null)
    const [runInput, setRunInput] = useState(BLANK_TOOL.exampleInput)
    const [activeTab, setActiveTab] = useState<ActiveTab>("run")
    const [runHistoryByTool, setRunHistoryByTool] = useState<
        Record<string, RunHistoryEntry[]>
    >({})
    const [resultsPanel, setResultsPanel] = useState<PanelState | null>(null)
    const [editorPanel, setEditorPanel] = useState<PanelState | null>(null)
    const [busyActions, setBusyActions] = useState<Record<BusyAction, boolean>>(
        {
            seed: false,
            clear: false,
            generate: false,
            save: false,
            run: false,
        },
    )
    const [deletingToolName, setDeletingToolName] = useState<string | null>(
        null,
    )

    const currentToolName = currentTool?.name ?? ""
    const currentHistory = useMemo(
        () =>
            currentToolName ? (runHistoryByTool[currentToolName] ?? []) : [],
        [currentToolName, runHistoryByTool],
    )
    const inputFields = useMemo(
        () => inferInputFields(currentTool),
        [currentTool],
    )

    useEffect(() => {
        void refreshToolList().catch((error: unknown) => {
            setResultsPanel(
                createErrorPanel(error, "Unable to load the registry."),
            )
        })
    }, [])

    async function refreshToolList(preferredToolName?: string): Promise<void> {
        const payload = await fetchJson<ToolsListResponse>("/api/tools")
        const nextTools = payload.tools ?? []
        setTools(nextTools)

        if (nextTools.length === 0) {
            selectUnsavedTool()
            return
        }

        const nextToolName =
            preferredToolName ?? currentTool?.name ?? nextTools[0]?.name

        if (
            nextToolName &&
            nextTools.some((tool) => tool.name === nextToolName)
        ) {
            await loadTool(nextToolName)
            return
        }

        selectUnsavedTool()
    }

    async function loadTool(name: string): Promise<void> {
        const payload = await fetchJson<ToolResponse>(
            `/api/tools/${encodeURIComponent(name)}`,
        )
        showTool(payload.tool)
    }

    function showTool(tool: ToolDefinition | null): void {
        setCurrentTool(tool)
        setEditorDraft({ ...(tool ?? BLANK_TOOL) })
        setRunInput(tool?.exampleInput ?? BLANK_TOOL.exampleInput)
        setResultsPanel(null)
        setEditorPanel(null)
    }

    function selectUnsavedTool(): void {
        showTool(null)
        setActiveTab("run")
    }

    function updateEditorDraft(changes: Partial<ToolDefinition>): void {
        setEditorDraft((current) => ({
            ...current,
            ...changes,
        }))
    }

    function setBusy(action: BusyAction, value: boolean): void {
        setBusyActions((current) => ({
            ...current,
            [action]: value,
        }))
    }

    async function handleSeedTools(): Promise<void> {
        setBusy("seed", true)
        try {
            const result = await fetchJson<SeedToolsResponse>(
                "/api/tools/seed",
                jsonRequest("POST"),
            )
            setResultsPanel({
                kind: "message",
                summary: `Seeded ${result.total} tool(s).`,
                message: `Created ${result.created} and updated ${result.updated} sample tool(s).`,
            })
            await refreshToolList()
        } catch (error) {
            setResultsPanel(createErrorPanel(error))
        } finally {
            setBusy("seed", false)
        }
    }

    async function handleClearTools(): Promise<void> {
        if (
            !confirm("Clear every saved tool from the Durable Object registry?")
        ) {
            return
        }

        setBusy("clear", true)
        try {
            const result = await fetchJson<ClearToolsResponse>(
                "/api/tools/clear",
                jsonRequest("POST"),
            )
            setResultsPanel({
                kind: "message",
                summary: "Registry cleared.",
                message: `Deleted ${result.deletedCount} tool(s).`,
            })
            setRunHistoryByTool({})
            await refreshToolList()
        } catch (error) {
            setResultsPanel(createErrorPanel(error))
        } finally {
            setBusy("clear", false)
        }
    }

    async function handleGenerateTool(): Promise<void> {
        const description = generationDescription.trim()

        if (!description) {
            setNewToolPanel({
                kind: "message",
                tone: "fail",
                message: "Describe what the tool should do, then generate it.",
            })
            return
        }

        setBusy("generate", true)
        setNewToolPanel({
            kind: "message",
            message: "Workers AI is drafting the schema and source...",
        })

        try {
            const result = await fetchJson<GenerateToolResponse>(
                "/api/tools/generate",
                jsonRequest("POST", {
                    description,
                }),
            )
            setNewToolDraft({ ...result.tool })
            setNewToolPanel(null)
        } catch (error) {
            setNewToolPanel(createErrorPanel(error))
        } finally {
            setBusy("generate", false)
        }
    }

    async function handleSaveTool(): Promise<void> {
        setBusy("save", true)
        try {
            const result = await fetchJson<ToolResponse>(
                "/api/tools",
                jsonRequest("POST", editorDraft),
            )
            setEditorPanel({
                kind: "message",
                message: `Persisted ${result.tool.name} in the Durable Object registry.`,
            })
            await refreshToolList(result.tool.name)
        } catch (error) {
            setEditorPanel(createErrorPanel(error))
        } finally {
            setBusy("save", false)
        }
    }

    async function deleteToolByName(name: string): Promise<void> {
        setDeletingToolName(name)
        try {
            await fetchJson<{ deleted: boolean; name: string }>(
                `/api/tools/${encodeURIComponent(name)}`,
                { method: "DELETE" },
            )
            setRunHistoryByTool((current) => {
                const next = { ...current }
                delete next[name]
                return next
            })
            setEditorPanel({
                kind: "message",
                message: `Removed ${name} from the registry.`,
            })
            await refreshToolList()
        } catch (error) {
            setEditorPanel(createErrorPanel(error))
        } finally {
            setDeletingToolName(null)
        }
    }

    async function handleDeleteToolFromEditor(): Promise<void> {
        const name = currentTool?.name.trim()
        if (!name) {
            setEditorPanel({
                kind: "message",
                tone: "fail",
                message: "Select a saved tool first.",
            })
            return
        }

        if (!confirm(`Delete ${name}?`)) {
            return
        }

        await deleteToolByName(name)
    }

    async function handleRunTool(): Promise<void> {
        if (!currentTool) {
            setResultsPanel({
                kind: "message",
                tone: "fail",
                message: "There is no saved tool selected.",
            })
            return
        }

        let input: unknown
        try {
            input = JSON.parse(runInput || "{}")
        } catch {
            setResultsPanel({
                kind: "message",
                tone: "fail",
                message: "Fix the JSON in the run input editor first.",
            })
            return
        }

        setBusy("run", true)
        setResultsPanel({
            kind: "message",
            message: "Executing inside a Dynamic Worker...",
        })

        try {
            const result = await fetchJson<RunToolResponse>(
                "/api/run",
                jsonRequest("POST", {
                    name: currentTool.name,
                    input,
                }),
            )

            setRunHistoryByTool((current) =>
                pushRunHistory(current, currentTool.name, {
                    status: "success",
                    at: new Date().toISOString(),
                    durationMs: result.durationMs,
                    input,
                    output: result.output,
                }),
            )
            setResultsPanel({
                kind: "status",
                tone: "pass",
                label: "Success",
                meta: `${result.durationMs}ms · isolate`,
                sections: [formatJson(result.output)],
            })
        } catch (error) {
            setRunHistoryByTool((current) =>
                pushRunHistory(current, currentTool.name, {
                    status: "error",
                    at: new Date().toISOString(),
                    input,
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unexpected error.",
                }),
            )
            setResultsPanel(createErrorPanel(error))
        } finally {
            setBusy("run", false)
        }
    }

    function handleLoadExample(): void {
        setRunInput(
            currentTool?.exampleInput ||
                editorDraft.exampleInput ||
                BLANK_TOOL.exampleInput,
        )
    }

    function updateNewToolDraft(changes: Partial<ToolDefinition>): void {
        setNewToolDraft((current) =>
            current ? { ...current, ...changes } : current,
        )
    }

    async function handleSaveNewTool(): Promise<void> {
        if (!newToolDraft) return

        setBusy("save", true)
        try {
            const result = await fetchJson<ToolResponse>(
                "/api/tools",
                jsonRequest("POST", newToolDraft),
            )
            closeNewToolModal()
            await refreshToolList(result.tool.name)
        } catch (error) {
            setNewToolPanel(createErrorPanel(error))
        } finally {
            setBusy("save", false)
        }
    }

    function resetNewToolModal(): void {
        setGenerationDescription("")
        setNewToolDraft(null)
        setNewToolPanel(null)
    }

    function closeNewToolModal(): void {
        setIsNewToolModalOpen(false)
        resetNewToolModal()
    }

    function handleNewTool(): void {
        resetNewToolModal()
        setIsNewToolModalOpen(true)
    }

    return {
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
    }
}
