import type { SerializedErrorDetails } from "./types"

export class HttpError extends Error {
    readonly status: number
    readonly details?: unknown

    constructor(status: number, message: string, details?: unknown) {
        super(message)
        this.name = "HttpError"
        this.status = status
        this.details = details
    }
}

export async function readJson<T>(request: Request): Promise<T> {
    try {
        return (await request.json()) as T
    } catch {
        throw new HttpError(400, "Request body must be valid JSON.")
    }
}

export function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json; charset=UTF-8",
            "cache-control": "no-store",
        },
    })
}

export function errorResponse(error: unknown, status: number): Response {
    const details = serializeErrorDetails(error)
    return jsonResponse(
        {
            error: details.message,
            status,
            details,
        },
        status,
    )
}

export function logRequestError(error: unknown): void {
    const details = serializeErrorDetails(error)
    console.error("Worker request failed:", JSON.stringify(details, null, 2))
}

export function serializeErrorDetails(error: unknown): SerializedErrorDetails {
    if (error instanceof HttpError) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...(error.details ? { details: error.details } : {}),
        }
    }

    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...(error.cause
                ? { cause: serializeUnknownValue(error.cause) }
                : {}),
        }
    }

    return {
        name: "Error",
        message: typeof error === "string" ? error : "Unexpected error.",
        raw: serializeUnknownValue(error),
    }
}

export function safeJsonPreview(value: unknown, maxLength = 1200): string {
    try {
        const text = JSON.stringify(value, null, 2)
        return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
    } catch {
        return String(value)
    }
}

export function safeTextPreview(value: unknown, maxLength = 1200): string {
    const text = String(value ?? "")
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

function serializeUnknownValue(value: unknown): unknown {
    if (value === undefined || value === null) {
        return value
    }

    if (value instanceof Error) {
        return serializeErrorDetails(value)
    }

    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        return value
    }

    try {
        return JSON.parse(JSON.stringify(value)) as unknown
    } catch {
        return String(value)
    }
}
