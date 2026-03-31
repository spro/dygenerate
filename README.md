# dygenerate

Generate JavaScript functions, save them, and run them inside Cloudflare Dynamic Workers.

The main point of this project is simple:

- describe a function in plain English
- let Workers AI draft it
- save it in a registry
- execute it in an isolated Dynamic Worker sandbox
- allow one generated function to call another through a narrow RPC capability

That makes it possible to build small chains of generated tools such as `doubleNthFibonacci` calling `nthFibonacci`.

## What it uses

- **Cloudflare Workers** for the main API
- **Dynamic Workers** for isolated execution of generated code
- **Durable Objects** for the tool registry
- **Workers AI** for tool generation
- **Vite + React + TypeScript** for the browser UI

## How it works

Each saved tool stores:

- `name`
- `description`
- `inputSchemaSource`
- `exampleInput`
- `executeSource`

`executeSource` is a JavaScript function expression. It receives:

1. the input object
2. an optional `tools` helper for calling other saved tools

Example:

```js
async ({ n }, tools) => {
    const fibonacci = await tools.callTool("nthFibonacci", { n })

    return {
        value: fibonacci.value * 2,
    }
}
```

Generated code runs inside a Dynamic Worker with:

```js
globalOutbound: null
```

so sandboxed tool code cannot make arbitrary outbound network requests.

## Tool-to-tool calls

Nested tool calls are handled by a host-provided `ToolExecutor` RPC entrypoint.

The sandbox does **not** get direct access to the registry or the broader Worker environment. Instead, it only gets this narrow capability:

```js
await tools.callTool(name, input)
```

Current safeguards:

- recursive cycles are blocked
- maximum tool-call depth is limited

## Seeded examples

The seeded tools include:

- `randomWord`
- `reverseText`
- `sumNumbers`
- `nthFibonacci`
- `doubleNthFibonacci`

`doubleNthFibonacci` demonstrates cross-tool execution by calling `nthFibonacci` from inside the sandbox.

## API routes

The Worker exposes:

- `GET /api/tools`
- `POST /api/tools`
- `GET /api/tools/:name`
- `DELETE /api/tools/:name`
- `POST /api/tools/generate`
- `POST /api/tools/seed`
- `POST /api/tools/clear`
- `POST /api/run`

## Project structure

### `src/index.ts`

Main Worker entrypoint and RPC surface.

Contains:

- the HTTP API routes
- `ToolExecutor`, which allows one generated tool to call another
- the exported `ToolRegistry` Durable Object binding

### `src/worker/registry.ts`

Durable Object-backed storage for saved tools.

### `src/worker/sandbox.ts`

Builds the Dynamic Worker wrapper around `executeSource` and injects the optional tool-calling capability.

### `src/worker/ai.ts`

Builds prompts for Workers AI and normalizes generated tool definitions.

### `src/client/*`

Browser UI for creating, editing, running, and inspecting tools.

## Local development

Install dependencies:

```bash
npm install
```

Generate Worker types after binding changes:

```bash
npm run types
```

Start local development:

```bash
npm run dev
```

Build everything:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

Deploy:

```bash
npm run deploy
```

## Notes

- This is a demo project for generated function execution, not a hardened multi-tenant platform.
- Tool definitions are persisted in a Durable Object rather than an external database.
- Workers AI is used to draft tools, but tools can also be written or edited manually.
- If you change bindings in `wrangler.jsonc`, rerun `npm run types`.
