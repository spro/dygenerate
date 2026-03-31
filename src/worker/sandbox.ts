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

export interface ToolExecutorBinding {
    callTool(name: string, input: unknown): Promise<unknown>
}

interface RunToolInSandboxOptions {
    toolExecutor?: ToolExecutorBinding
}

export async function runToolInSandbox(
    env: Env,
    tool: ToolDefinition,
    input: unknown,
    options: RunToolInSandboxOptions = {},
): Promise<{
    output: unknown
    durationMs: number
}> {
    try {
        const workerCode = buildWorkerCode(tool, options)
        const worker = options.toolExecutor
            ? env.LOADER.load(workerCode)
            : env.LOADER.get(
                  `${tool.name}:${await hashText(tool.executeSource)}`,
                  async () => workerCode,
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

function buildWorkerCode(
    tool: ToolDefinition,
    options: RunToolInSandboxOptions,
) {
    return {
        compatibilityDate: COMPATIBILITY_DATE,
        mainModule: "index.js",
        modules: {
            "index.js": buildSandboxModule(tool.name, tool.executeSource),
        },
        ...(options.toolExecutor
            ? {
                  env: {
                      TOOL_EXECUTOR: options.toolExecutor,
                  },
              }
            : {}),
        globalOutbound: null,
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

		const tools = {
			callTool: async (name, nextInput) => {
				if (
					!this.env.TOOL_EXECUTOR ||
					typeof this.env.TOOL_EXECUTOR.callTool !== "function"
				) {
					throw new Error(
						"Tool execution context does not allow calling other saved tools.",
					);
				}

				return structuredClone(
					await this.env.TOOL_EXECUTOR.callTool(name, nextInput),
				);
			},
		};

		try {
			const output = await execute(input, tools);
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
