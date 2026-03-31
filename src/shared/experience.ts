export const EXPERIENCE_ID_HEADER = "x-dygenerate-experience-id"
export const EXPERIENCE_ID_STORAGE_KEY = "dygenerate.experience-id"
export const EXPERIENCE_QUERY_PARAM = "workspace"
export const DEFAULT_EXPERIENCE_ID = "global"

const EXPERIENCE_ID_PREFIX = "experience-"
const EXPERIENCE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{5,127}$/

let cachedExperienceId: string | null = null

export function normalizeExperienceId(value: unknown): string | null {
    if (typeof value !== "string") {
        return null
    }

    const normalized = value.trim().toLowerCase()
    if (!normalized || !EXPERIENCE_ID_PATTERN.test(normalized)) {
        return null
    }

    return normalized
}

export function resolveExperienceId(value: unknown): string {
    return normalizeExperienceId(value) ?? DEFAULT_EXPERIENCE_ID
}

export function buildRegistryObjectName(value: unknown): string {
    return `${EXPERIENCE_ID_PREFIX}${resolveExperienceId(value)}`
}

export function getOrCreateExperienceId(): string {
    if (cachedExperienceId) {
        return cachedExperienceId
    }

    const urlExperienceId = readUrlExperienceId()
    if (urlExperienceId) {
        cachedExperienceId = urlExperienceId
        writeStoredExperienceId(urlExperienceId)
        syncExperienceIdToUrl(urlExperienceId)
        return urlExperienceId
    }

    const storedExperienceId = readStoredExperienceId()
    if (storedExperienceId) {
        cachedExperienceId = storedExperienceId
        syncExperienceIdToUrl(storedExperienceId)
        return storedExperienceId
    }

    const nextExperienceId = createExperienceId()
    cachedExperienceId = nextExperienceId
    writeStoredExperienceId(nextExperienceId)
    syncExperienceIdToUrl(nextExperienceId)
    return nextExperienceId
}

export function formatShortExperienceId(
    experienceId: string,
    visibleLength = 8,
): string {
    return experienceId.length <= visibleLength
        ? experienceId
        : experienceId.slice(0, visibleLength)
}

function createExperienceId(): string {
    const generatedId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `exp_${Math.random().toString(36).slice(2, 14)}`

    return resolveExperienceId(generatedId)
}

function readUrlExperienceId(): string | null {
    if (typeof window === "undefined") {
        return null
    }

    try {
        return normalizeExperienceId(
            new URL(window.location.href).searchParams.get(
                EXPERIENCE_QUERY_PARAM,
            ),
        )
    } catch {
        return null
    }
}

function syncExperienceIdToUrl(experienceId: string): void {
    if (
        typeof window === "undefined" ||
        typeof window.history?.replaceState !== "function"
    ) {
        return
    }

    try {
        const url = new URL(window.location.href)
        if (url.searchParams.get(EXPERIENCE_QUERY_PARAM) === experienceId) {
            return
        }

        url.searchParams.set(EXPERIENCE_QUERY_PARAM, experienceId)
        window.history.replaceState({}, "", url)
    } catch {
        // Ignore URL update failures and keep using the resolved workspace id.
    }
}

function readStoredExperienceId(): string | null {
    if (typeof localStorage === "undefined") {
        return null
    }

    try {
        return normalizeExperienceId(
            localStorage.getItem(EXPERIENCE_ID_STORAGE_KEY),
        )
    } catch {
        return null
    }
}

function writeStoredExperienceId(experienceId: string): void {
    if (typeof localStorage === "undefined") {
        return
    }

    try {
        localStorage.setItem(EXPERIENCE_ID_STORAGE_KEY, experienceId)
    } catch {
        // Ignore storage failures and keep the in-memory id for this page load.
    }
}
