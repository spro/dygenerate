import { twMerge } from "tailwind-merge"
import type { ErrorSection, PanelState, PanelTone } from "../types"

export function Panel({ panel }: { panel: PanelState }) {
    return (
        <div className="mt-3 grid gap-2">
            {panel.kind === "message" ? (
                <MessageCard message={panel.message} tone={panel.tone} />
            ) : panel.kind === "status" ? (
                <StatusCard
                    tone={panel.tone}
                    label={panel.label}
                    meta={panel.meta}
                    sections={panel.sections}
                />
            ) : (
                <ErrorCard
                    message={panel.message}
                    prominentSections={panel.prominentSections}
                    details={panel.details}
                />
            )}
        </div>
    )
}

export function MessageCard({
    message,
    tone = "neutral",
}: {
    message: string
    tone?: PanelTone
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
    return (
        <div className={twMerge(cardBaseClass, toneCardClass("fail"))}>
            <p className="m-0">{message}</p>
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

const cardBaseClass =
    "border p-3 text-sm leading-6 text-zinc-800 whitespace-pre-wrap break-words"

function toneCardClass(tone: PanelTone): string {
    if (tone === "pass") {
        return "border-emerald-300 bg-emerald-50"
    }

    if (tone === "fail") {
        return "border-red-300 bg-red-50"
    }

    return "border-stone-300 bg-white"
}
