import { COMPATIBILITY_DATE } from "./constants"
import {
    HttpError,
    safeJsonPreview,
    safeTextPreview,
    serializeErrorDetails,
} from "./http"
import { hashText } from "./tool-definition"
import type { ToolDefinition } from "./types"

interface SandboxEntrypoint {
    run(input: unknown): Promise<unknown>
}

export async function runToolInSandbox(
    env: Env,
    tool: ToolDefinition,
    input: unknown,
): Promise<{
    output: unknown
    durationMs: number
}> {
    try {
        const worker = env.LOADER.get(
            `${tool.name}:${await hashText(tool.executeSource)}`,
            () => ({
                compatibilityDate: COMPATIBILITY_DATE,
                mainModule: "index.js",
                modules: {
                    "index.js": buildSandboxModule(
                        tool.name,
                        tool.executeSource,
                    ),
                },
                globalOutbound: null,
            }),
        )
        const sandbox = worker.getEntrypoint(
            "ToolSandbox",
        ) as unknown as SandboxEntrypoint
        const startedAt = performance.now()
        const output = await sandbox.run(input)

        return {
            output,
            durationMs: Math.round(performance.now() - startedAt),
        }
    } catch (error) {
        throw new HttpError(
            500,
            `Tool "${tool.name}" failed while running in the sandbox.`,
            {
                toolName: tool.name,
                inputPreview: safeJsonPreview(input),
                executeSourcePreview: safeTextPreview(tool.executeSource, 2500),
                cause: serializeErrorDetails(error),
            },
        )
    }
}

function buildSandboxModule(toolName: string, executeSource: string): string {
    return `import { WorkerEntrypoint } from "cloudflare:workers";

const toolName = ${JSON.stringify(toolName)};
const executeSource = ${JSON.stringify(executeSource)};
let execute = null;
let executeInitError = null;

try {
	execute = Function('"use strict"; return (' + executeSource + ');')();
} catch (error) {
	executeInitError = error;
}

function formatSandboxError(error) {
	if (error instanceof Error) {
		return error.stack || error.message;
	}

	try {
		return JSON.stringify(error, null, 2);
	} catch {
		return String(error);
	}
}

function ensureNamedOutput(output) {
	if (output && typeof output === "object" && !Array.isArray(output)) {
		return {
			...output,
			name: toolName,
		};
	}

	return {
		name: toolName,
		output,
	};
}

export class ToolSandbox extends WorkerEntrypoint {
	async run(input) {
		if (executeInitError) {
			throw new Error(
				"Tool initialization failed before execution.\\n" +
				formatSandboxError(executeInitError),
			);
		}

		if (typeof execute !== "function") {
			throw new Error("executeSource must evaluate to a function expression.");
		}

		try {
			const output = await execute(input);
			return structuredClone(ensureNamedOutput(output));
		} catch (error) {
			throw new Error(
				"Tool execution failed inside the sandbox.\\n" +
				formatSandboxError(error),
			);
		}
	}
}`
}
