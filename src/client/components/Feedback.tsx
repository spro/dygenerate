import { useState } from "react"
import { twMerge } from "tailwind-merge"
import type { ErrorSection } from "../types"

export type FeedbackTone = "neutral" | "pass" | "fail" | "warn"

export function MessageCard({
    message,
    tone = "neutral",
}: {
    message: string
    tone?: FeedbackTone
}) {
    return (
        <div className={twMerge(cardBaseClass, toneCardClass(tone))}>
            {message}
        </div>
    )
}

export function StatusCard({
    tone,
    label,
    meta,
    sections,
}: {
    tone: "pass" | "fail"
    label: string
    meta: string
    sections: string[]
}) {
    return (
        <div className={twMerge(cardBaseClass, toneCardClass(tone))}>
            <div
                className={twMerge(
                    "flex items-center justify-between gap-3 font-medium",
                    tone === "pass" ? "text-emerald-700" : "text-red-700",
                )}
            >
                <span>{label}</span>
                <span className="text-sm">{meta}</span>
            </div>
            {sections.map((section, index) => (
                <pre
                    key={`${meta}-${index}`}
                    className="mt-3 overflow-auto whitespace-pre-wrap break-words border border-current/15 bg-white p-3 font-mono text-sm leading-6 text-zinc-900"
                >
                    {section}
                </pre>
            ))}
        </div>
    )
}

export function ErrorCard({
    message,
    prominentSections,
    details,
}: {
    message: string
    prominentSections: ErrorSection[]
    details?: string
}) {
    const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
        "idle",
    )

    async function handleCopy(): Promise<void> {
        if (!navigator.clipboard?.writeText) {
            setCopyState("failed")
            window.setTimeout(() => setCopyState("idle"), 2000)
            return
        }

        try {
            await navigator.clipboard.writeText(
                buildErrorClipboardText(message, prominentSections, details),
            )
            setCopyState("copied")
        } catch {
            setCopyState("failed")
        }

        window.setTimeout(() => setCopyState("idle"), 2000)
    }

    return (
        <div className={twMerge(cardBaseClass, toneCardClass("fail"))}>
            <div className="flex items-start justify-between gap-3">
                <p className="m-0 flex-1">{message}</p>
                <button
                    type="button"
                    className="shrink-0 border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100"
                    onClick={() => void handleCopy()}
                >
                    {copyState === "copied"
                        ? "Copied"
                        : copyState === "failed"
                          ? "Copy failed"
                          : "Copy error"}
                </button>
            </div>
            {prominentSections.map((section) => (
                <div
                    key={section.label}
                    className="mt-3 border border-red-200 bg-white p-3"
                >
                    <div className="text-xs font-medium uppercase tracking-[0.06em] text-red-700">
                        {section.label}
                    </div>
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words font-mono text-sm leading-6 text-zinc-900">
                        {section.content}
                    </pre>
                </div>
            ))}
            {details ? (
                <details className="mt-3">
                    <summary className="cursor-pointer font-medium">
                        Debug details
                    </summary>
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words border border-red-200 bg-white p-3 font-mono text-sm leading-6 text-zinc-900">
                        {details}
                    </pre>
                </details>
            ) : null}
        </div>
    )
}

function buildErrorClipboardText(
    message: string,
    prominentSections: ErrorSection[],
    details?: string,
): string {
    const parts = [`Error\n${message}`]

    for (const section of prominentSections) {
        parts.push(`${section.label}\n${section.content}`)
    }

    if (details) {
        parts.push(`Debug details\n${details}`)
    }

    return parts.join("\n\n")
}

const cardBaseClass =
    "border p-3 text-sm leading-6 text-zinc-800 whitespace-pre-wrap break-words"

function toneCardClass(tone: FeedbackTone): string {
    if (tone === "pass") {
        return "border-emerald-300 bg-emerald-50"
    }

    if (tone === "fail") {
        return "border-red-300 bg-red-50"
    }

    if (tone === "warn") {
        return "border-amber-300 bg-amber-50"
    }

    return "border-stone-300 bg-white"
}
