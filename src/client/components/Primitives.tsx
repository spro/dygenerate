import type {
    ButtonHTMLAttributes,
    InputHTMLAttributes,
    ReactNode,
    TextareaHTMLAttributes,
} from "react"
import { twMerge } from "tailwind-merge"

export const panelSurfaceClass = "flex min-w-0 flex-col bg-white"

export const contentCardClass =
    "flex flex-col border border-stone-300 bg-white p-3"

export const codeBlockClass =
    "overflow-auto border border-stone-300 bg-stone-950 px-4 py-3 font-mono text-sm leading-6 text-stone-100 whitespace-pre-wrap break-words"

export function Button({
    variant = "secondary",
    size = "md",
    className,
    type = "button",
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            className={twMerge(
                "inline-flex items-center justify-center gap-2 whitespace-nowrap border text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 active:translate-y-px disabled:cursor-wait disabled:opacity-60",
                buttonSizeClasses[size],
                buttonVariantClasses[variant],
                className,
            )}
            {...props}
        />
    )
}

export function TabButton({
    active,
    className,
    type = "button",
    ...props
}: TabButtonProps) {
    return (
        <button
            type={type}
            className={twMerge(
                "inline-flex items-center justify-center border-b px-3 py-2 text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 active:translate-y-px disabled:cursor-wait disabled:opacity-60",
                active
                    ? "border-stone-900 text-stone-900"
                    : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-900",
                className,
            )}
            {...props}
        />
    )
}

export function Field({ label, hint, className, children }: FieldProps) {
    return (
        <label className={twMerge("flex flex-col gap-2", className)}>
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-stone-900">
                    {label}
                </span>
                {hint ? (
                    <span className="text-xs text-stone-500">{hint}</span>
                ) : null}
            </div>
            {children}
        </label>
    )
}

export function TextInput({ className, ...props }: TextInputProps) {
    return (
        <input
            className={twMerge(
                "w-full border border-stone-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-1 focus:ring-stone-400",
                className,
            )}
            {...props}
        />
    )
}

export function TextArea({ className, ...props }: TextAreaProps) {
    return (
        <textarea
            className={twMerge(
                "w-full border border-stone-300 bg-white px-3 py-2 font-mono text-sm leading-6 text-zinc-900 outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-1 focus:ring-stone-400",
                className,
            )}
            {...props}
        />
    )
}

const buttonVariantClasses = {
    primary: "border-stone-900 bg-stone-900 text-white hover:bg-stone-800",
    secondary: "border-stone-300 bg-white text-zinc-900 hover:bg-stone-100",
    subtle: "border-stone-300 bg-stone-100 text-stone-800 hover:bg-stone-200",
    danger: "border-red-300 bg-white text-red-700 hover:bg-red-50",
    ghost: "border-transparent bg-transparent text-stone-600 hover:bg-stone-100",
} as const

const buttonSizeClasses = {
    sm: "px-3 py-1.5",
    md: "px-4 py-2",
    lg: "px-5 py-2.5",
} as const

type ButtonVariant = keyof typeof buttonVariantClasses
type ButtonSize = keyof typeof buttonSizeClasses

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
    size?: ButtonSize
}

type TabButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    active: boolean
}

type FieldProps = {
    label: ReactNode
    hint?: ReactNode
    className?: string
    children: ReactNode
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement>
type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>
