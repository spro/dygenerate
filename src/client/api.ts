import type { ApiErrorPayload, ErrorSection, PanelState } from "./types"

export class ApiError extends Error {
    readonly status: number
    readonly payload: ApiErrorPayload

    constructor(message: string, status: number, payload: ApiErrorPayload) {
        super(message)
        this.name = "ApiError"
        this.status = status
        this.payload = payload
    }
}

export async function fetchJson<T>(
    url: string,
    options?: RequestInit,
): Promise<T> {
    const response = await fetch(url, options)
    const rawText = await response.text()
    let payload: ApiErrorPayload = {}

    if (rawText) {
        try {
            payload = JSON.parse(rawText) as ApiErrorPayload
        } catch {
            payload = {
                rawText,
                parseError: "Response body was not valid JSON.",
            }
        }
    }

    if (!response.ok) {
        throw new ApiError(
            payload.error || `Request failed with HTTP ${response.status}.`,
            response.status,
            {
                ...payload,
                responseMeta: {
                    status: response.status,
                    statusText: response.statusText,
                    contentType: response.headers.get("content-type"),
                },
            },
        )
    }

    return payload as T
}

export function jsonRequest(method: string, body?: unknown): RequestInit {
    if (body === undefined) {
        return { method }
    }

    return {
        method,
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    }
}

const ERROR_SECTION_CONFIG = [
    { key: "responsePreview", label: "Workers AI response snippet" },
    { key: "aiResultPreview", label: "Workers AI raw result preview" },
    { key: "executeSourcePreview", label: "Tool source preview" },
    { key: "inputPreview", label: "Run input preview" },
] as const

export function createErrorPanel(error: unknown, summary?: string): PanelState {
    const defaultSummary =
        error instanceof ApiError
            ? `Request failed (HTTP ${error.status}).`
            : "Request failed."
    const message = error instanceof Error ? error.message : "Unexpected error."

    return {
        kind: "error",
        summary: summary ?? defaultSummary,
        message,
        prominentSections: extractProminentErrorSections(error),
        details: formatErrorDebug(error),
    }
}

function formatErrorDebug(error: unknown): string | undefined {
    if (error instanceof ApiError) {
        return JSON.stringify(error.payload, null, 2)
    }
    if (error instanceof Error) {
        return error.stack || `${error.name}: ${error.message}`
    }
    try {
        return JSON.stringify(error, null, 2)
    } catch {
        return String(error)
    }
}

function extractProminentErrorSections(error: unknown): ErrorSection[] {
    const sections: ErrorSection[] = []
    const payload = error instanceof ApiError ? error.payload : null
    const details = payload?.details?.details ?? {}

    for (const config of ERROR_SECTION_CONFIG) {
        const content = details[config.key]
        if (typeof content === "string" && content.trim()) {
            sections.push({ label: config.label, content })
        }
    }

    if (typeof payload?.rawText === "string" && payload.rawText.trim()) {
        sections.push({
            label: "Raw HTTP response body",
            content: payload.rawText,
        })
    }

    return sections
}
