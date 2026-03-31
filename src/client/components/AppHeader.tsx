import { twMerge } from "tailwind-merge"
import { panelSurfaceClass } from "./Primitives"

export function AppHeader() {
    return (
        <header
            className={twMerge(
                panelSurfaceClass,
                "gap-4 p-4 sm:flex-row sm:items-center sm:justify-between",
            )}
        >
            <div>
                <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">
                    dygenerate
                </h1>
                <p className="mt-1 text-sm text-stone-500 sm:text-base">
                    Generate a feature, then refine it with prompts.
                </p>
            </div>
        </header>
    )
}
