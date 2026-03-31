import type { ToolDefinitionInput } from "./types"

export const COMPATIBILITY_DATE = "2026-03-17"
export const REGISTRY_OBJECT_NAME = "global"
export const TOOL_KEY_PREFIX = "tool:"
export const DEFAULT_EXAMPLE_INPUT = "{}"
export const TOOL_GENERATOR_MODEL = "@cf/qwen/qwen2.5-coder-32b-instruct"
export const MAX_TOOL_CALL_DEPTH = 8

export const TOOL_GENERATION_SCHEMA = {
    type: "object",
    properties: {
        name: {
            type: "string",
            description:
                "A concise camelCase or PascalCase tool name using only letters, digits, underscores, or hyphens.",
        },
        description: {
            type: "string",
            description: "A short description of what the tool does.",
        },
        inputSchemaSource: {
            type: "string",
            description:
                "A JavaScript Zod schema expression like z.object({ text: z.string() }) without backticks or Markdown code fences.",
        },
        exampleInput: {
            type: "string",
            description:
                "Valid JSON matching the schema, formatted as a string without backticks or Markdown code fences.",
        },
        executeSource: {
            type: "string",
            description:
                "An async JavaScript function expression that accepts the main input object as its first argument, may optionally accept a second tools argument with callTool(name, input), and returns a plain JSON-serializable object, without backticks or Markdown code fences.",
        },
    },
    required: [
        "name",
        "description",
        "inputSchemaSource",
        "exampleInput",
        "executeSource",
    ],
    additionalProperties: false,
} as const

export const SEEDED_TOOLS: ToolDefinitionInput[] = [
    {
        name: "randomWord",
        description: "Select a random word given a starting letter.",
        inputSchemaSource: `z.object({
  letter: z.string().describe("The starting letter of the word"),
})`,
        exampleInput: `{
  "letter": "c"
}`,
        executeSource: `async ({ letter }) => {
  return {
    word: \`${"${letter}"}asdf\`,
  }
}`,
    },
    {
        name: "reverseText",
        description: "Reverse the provided text.",
        inputSchemaSource: `z.object({
  text: z.string().describe("The text to reverse"),
})`,
        exampleInput: `{
  "text": "cloudflare"
}`,
        executeSource: `async ({ text }) => {
  return {
    text: text.split("").reverse().join(""),
  }
}`,
    },
    {
        name: "sumNumbers",
        description: "Add an array of numbers and return the total.",
        inputSchemaSource: `z.object({
  numbers: z.array(z.number()).describe("Numbers to add together"),
})`,
        exampleInput: `{
  "numbers": [1, 2, 3, 4]
}`,
        executeSource: `async ({ numbers }) => {
  return {
    total: numbers.reduce((sum, value) => sum + value, 0),
  }
}`,
    },
    {
        name: "nthFibonacci",
        description: "Return the nth Fibonacci number.",
        inputSchemaSource: `z.object({
  n: z.number().int().min(0).describe("Zero-based Fibonacci index"),
})`,
        exampleInput: `{
  "n": 8
}`,
        executeSource: `async ({ n }) => {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("n must be a non-negative integer")
  }

  let previous = 0
  let current = 1

  for (let index = 0; index < n; index += 1) {
    const next = previous + current
    previous = current
    current = next
  }

  return {
    value: previous,
  }
}`,
    },
    {
        name: "doubleNthFibonacci",
        description: "Call nthFibonacci and return double its value.",
        inputSchemaSource: `z.object({
  n: z.number().int().min(0).describe("Zero-based Fibonacci index"),
})`,
        exampleInput: `{
  "n": 8
}`,
        executeSource: `async ({ n }, tools) => {
  const fibonacci = await tools.callTool("nthFibonacci", { n })

  if (
    !fibonacci ||
    typeof fibonacci !== "object" ||
    typeof fibonacci.value !== "number"
  ) {
    throw new Error("nthFibonacci returned an unexpected result")
  }

  return {
    value: fibonacci.value * 2,
    original: fibonacci.value,
  }
}`,
    },
]
