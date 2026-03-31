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
                    A feature-first generated app runtime where model, actions, views, and live state evolve together.
                </p>
                <p className="mt-2 text-sm text-stone-400">
                    Start with a prompt like “create a todo app”, then keep steering the running state with follow-up prompts.
                </p>
            </div>
        </header>
    )
}
