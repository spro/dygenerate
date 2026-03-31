import type { ToolDefinitionInput } from "./types"

export const COMPATIBILITY_DATE = "2026-03-17"
export const TOOL_KEY_PREFIX = "tool:"
export const FEATURE_RUNTIME_KEY = "feature-runtime"
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
        outputSchemaSource: {
            type: "string",
            description:
                "A JavaScript Zod schema expression describing the JSON-serializable output, like z.object({ text: z.string() }), without backticks or Markdown code fences.",
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
        "outputSchemaSource",
        "exampleInput",
        "executeSource",
    ],
    additionalProperties: false,
} as const

export const COMPONENT_GENERATION_SCHEMA = {
    type: "object",
    properties: {
        name: {
            type: "string",
            description: "A concise PascalCase or camelCase component name.",
        },
        description: {
            type: "string",
            description: "A short description of the generated component.",
        },
        kind: {
            type: "string",
            enum: ["toolForm"],
            description: "The type of component to render.",
        },
        title: {
            type: "string",
            description: "Primary heading for the component preview.",
        },
        subtitle: {
            type: "string",
            description: "Short supporting copy for the component.",
        },
        submitLabel: {
            type: "string",
            description: "Text shown on the main action button.",
        },
        resultTitle: {
            type: "string",
            description: "Heading shown above the result area.",
        },
        emptyResultMessage: {
            type: "string",
            description: "Message shown before the tool has run.",
        },
        accentColor: {
            type: "string",
            enum: ["stone", "blue", "emerald", "violet"],
            description: "Accent color used for the preview chrome.",
        },
        fieldConfig: {
            type: "object",
            description:
                "Per-field UI metadata keyed by tool input field name.",
            additionalProperties: {
                type: "object",
                properties: {
                    label: { type: "string" },
                    helpText: { type: "string" },
                    placeholder: { type: "string" },
                },
                required: ["label", "helpText", "placeholder"],
                additionalProperties: false,
            },
        },
    },
    required: [
        "name",
        "description",
        "kind",
        "title",
        "subtitle",
        "submitLabel",
        "resultTitle",
        "emptyResultMessage",
        "accentColor",
        "fieldConfig",
    ],
    additionalProperties: false,
} as const

export const FEATURE_GENERATION_SCHEMA = {
    type: "object",
    properties: {
        name: { type: "string" },
        description: { type: "string" },
        entityName: { type: "string" },
        collectionName: { type: "string" },
        primaryField: { type: "string" },
        statusField: { type: "string" },
        fields: {
            type: "object",
            additionalProperties: {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        enum: ["string", "number", "boolean"],
                    },
                    label: { type: "string" },
                    description: { type: "string" },
                },
                required: ["type", "label", "description"],
                additionalProperties: false,
            },
        },
        actions: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    kind: {
                        type: "string",
                        enum: ["create", "updateField", "toggleBoolean", "delete"],
                    },
                    label: { type: "string" },
                    field: { type: "string" },
                },
                required: ["name", "kind", "label"],
                additionalProperties: false,
            },
        },
        views: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    kind: {
                        type: "string",
                        enum: ["list", "form", "stats"],
                    },
                    title: { type: "string" },
                    description: { type: "string" },
                    visibleFields: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
                required: ["name", "kind", "title", "description", "visibleFields"],
                additionalProperties: false,
            },
        },
        initialEntities: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: true,
            },
        },
    },
    required: [
        "name",
        "description",
        "entityName",
        "collectionName",
        "primaryField",
        "fields",
        "actions",
        "views",
        "initialEntities",
    ],
    additionalProperties: false,
} as const

export const FEATURE_PATCH_SCHEMA = {
    type: "object",
    properties: {
        summary: { type: "string" },
        patches: {
            type: "array",
            items: {
                anyOf: [
                    {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["entity.add"] },
                            entity: {
                                type: "object",
                                additionalProperties: true,
                            },
                        },
                        required: ["type", "entity"],
                        additionalProperties: false,
                    },
                    {
                        type: "object",
                        properties: {
                            type: {
                                type: "string",
                                enum: ["entity.updateField"],
                            },
                            target: {
                                type: "object",
                                properties: {
                                    index: { type: "number" },
                                },
                                required: ["index"],
                                additionalProperties: false,
                            },
                            field: { type: "string" },
                            value: {},
                        },
                        required: ["type", "target", "field", "value"],
                        additionalProperties: false,
                    },
                    {
                        type: "object",
                        properties: {
                            type: {
                                type: "string",
                                enum: ["entity.toggleField"],
                            },
                            target: {
                                type: "object",
                                properties: {
                                    index: { type: "number" },
                                },
                                required: ["index"],
                                additionalProperties: false,
                            },
                            field: { type: "string" },
                        },
                        required: ["type", "target", "field"],
                        additionalProperties: false,
                    },
                    {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["entity.remove"] },
                            target: {
                                type: "object",
                                properties: {
                                    index: { type: "number" },
                                },
                                required: ["index"],
                                additionalProperties: false,
                            },
                        },
                        required: ["type", "target"],
                        additionalProperties: false,
                    },
                    {
                        type: "object",
                        properties: {
                            type: {
                                type: "string",
                                enum: ["entity.replaceAll"],
                            },
                            entities: {
                                type: "array",
                                items: {
                                    type: "object",
                                    additionalProperties: true,
                                },
                            },
                        },
                        required: ["type", "entities"],
                        additionalProperties: false,
                    },
                ],
            },
        },
    },
    required: ["summary", "patches"],
    additionalProperties: false,
} as const

export const SEEDED_TOOLS: ToolDefinitionInput[] = [
    {
        name: "randomWord",
        description: "Select a random word given a starting letter.",
        inputSchemaSource: `z.object({
  letter: z.string().describe("The starting letter of the word"),
})`,
        outputSchemaSource: `z.object({
  word: z.string().describe("A generated word that starts with the requested letter"),
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
        outputSchemaSource: `z.object({
  text: z.string().describe("The reversed text"),
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
        outputSchemaSource: `z.object({
  total: z.number().describe("The sum of all provided numbers"),
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
        outputSchemaSource: `z.object({
  value: z.number().int().describe("The Fibonacci value at the requested index"),
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
        outputSchemaSource: `z.object({
  value: z.number().int().describe("Double the Fibonacci value at the requested index"),
  original: z.number().int().describe("The original Fibonacci value before doubling"),
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
