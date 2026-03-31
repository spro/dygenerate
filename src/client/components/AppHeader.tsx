import {
    formatShortExperienceId,
    getOrCreateExperienceId,
} from "../../shared/experience"

export function AppHeader() {
    const experienceId = getOrCreateExperienceId()

    return (
        <header className="flex min-w-0 flex-col gap-3 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">
                    dygenerate
                </h1>
            </div>

            <div className="text-sm text-stone-500">
                Workspace {formatShortExperienceId(experienceId)}
            </div>
        </header>
    )
}
