import type { ToolDefinitionInput } from "./types"

export const COMPATIBILITY_DATE = "2026-03-24"
export const REGISTRY_OBJECT_NAME = "global"
export const TOOL_KEY_PREFIX = "tool:"
export const DEFAULT_EXAMPLE_INPUT = "{}"
export const TOOL_GENERATOR_MODEL = "@cf/qwen/qwen2.5-coder-32b-instruct"

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
                "An async JavaScript function expression that accepts one object argument and returns a plain JSON-serializable object, without backticks or Markdown code fences.",
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
]
