export function formatJson(value: unknown): string {
    return JSON.stringify(value, null, 2) ?? "undefined"
}

export function formatDate(value: string): string {
    return new Date(value).toLocaleString()
}

