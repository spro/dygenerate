import { twMerge } from "tailwind-merge"
import type { ToolSummary } from "../types"
import { MessageCard } from "./Panel"
import { panelSurfaceClass } from "./Primitives"

interface RegistrySidebarProps {
    tools: ToolSummary[]
    currentToolName: string
    onSelectTool: (name: string) => void
}

export function RegistrySidebar({
    tools,
    currentToolName,
    onSelectTool,
}: RegistrySidebarProps) {
    return (
        <aside className={twMerge(panelSurfaceClass, "p-4")}>
            <div className="flex items-center justify-between gap-3 border-b border-stone-300 pb-3">
                <h2 className="text-sm font-medium text-stone-900">Tools</h2>
                <span className="text-sm text-stone-500">{tools.length}</span>
            </div>

            <div className="mt-4 grid gap-px border border-stone-300 bg-stone-300">
                {tools.length === 0 ? (
                    <div className="bg-white p-3">
                        <MessageCard message="No saved tools." />
                    </div>
                ) : (
                    tools.map((tool) => {
                        const isActive = tool.name === currentToolName

                        return (
                            <button
                                key={tool.name}
                                type="button"
                                className={twMerge(
                                    "flex w-full min-w-0 items-center justify-between gap-3 bg-white px-3 py-2 text-left text-sm transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 active:translate-y-px",
                                    isActive
                                        ? "bg-stone-900 text-blue-500"
                                        : "text-stone-900 hover:bg-stone-100",
                                )}
                                onClick={() => onSelectTool(tool.name)}
                            >
                                <span className="truncate">{tool.name}</span>
                            </button>
                        )
                    })
                )}
            </div>
        </aside>
    )
}
