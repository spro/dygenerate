import { twMerge } from "tailwind-merge"
import { Button, panelSurfaceClass } from "./Primitives"

interface AppHeaderProps {
    toolCount: number
    isClearing: boolean
    isSeeding: boolean
    onClearAll: () => void
    onNewTool: () => void
    onSeedSamples: () => void
}

export function AppHeader({
    isClearing,
    isSeeding,
    onClearAll,
    onNewTool,
    onSeedSamples,
}: AppHeaderProps) {
    return (
        <header
            className={twMerge(
                panelSurfaceClass,
                "gap-4 p-4 sm:flex-row sm:items-center sm:justify-between",
            )}
        >
            <div>
                <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">
                    Generated Isolates
                </h1>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                    variant="danger"
                    onClick={onClearAll}
                    disabled={isClearing}
                >
                    Clear all
                </Button>
                <Button
                    variant="secondary"
                    onClick={onSeedSamples}
                    disabled={isSeeding}
                >
                    Seed samples
                </Button>
                <Button variant="primary" onClick={onNewTool}>
                    New tool
                </Button>
            </div>
        </header>
    )
}
