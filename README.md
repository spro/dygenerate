# dygenerate

Generate JavaScript functions, save them, and run them inside Cloudflare Dynamic Workers.

This project is headed toward a bigger idea:

> A Cloudflare-native generated app runtime where backend capabilities are created as composable sandboxed tools, then exposed through generated APIs, then consumed by generated frontend components.

The current direction is becoming more feature-first than function-first: data model, actions, and UI should be generated together because they all collaborate around shared state.

Right now, the app already covers the first part of that loop:

- describe a function in plain English
- let Workers AI draft it
- save it in a registry
- execute it in an isolated Dynamic Worker sandbox
- allow one generated function to call another through a narrow RPC capability
- generate a feature definition where model, actions, and views are planned together
- keep a live app runtime in Zustand so follow-up prompts can patch state and update the UI immediately
- persist generated feature definitions and runtime state in the Durable Object registry so the app survives reloads

That makes it possible to build small chains of generated tools such as `doubleNthFibonacci` calling `nthFibonacci`, while also moving toward prompts like `create a todo app` followed by `set the second todo to done`.

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
- `outputSchemaSource`
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

## Live feature runtime

The main page now includes a feature studio that generates a shared feature definition, persists it in the Durable Object registry, and hydrates a Zustand-backed runtime store.

That runtime currently tracks:

- the active generated feature definition
- the current entity collection for that feature
- prompt history and applied patches
- a persisted copy of that runtime state in the Durable Object registry

This is the first step toward a conversational app loop where later prompts modify the already-running app instead of regenerating everything from scratch.

## API routes

The Worker currently exposes:

- `GET /api/tools`
- `POST /api/tools`
- `GET /api/tools/:name`
- `DELETE /api/tools/:name`
- `POST /api/tools/generate`
- `POST /api/tools/seed`
- `POST /api/tools/clear`
- `POST /api/components/generate`
- `POST /api/features/generate`
- `POST /api/features/patch`
- `GET /api/features/runtime`
- `POST /api/features/runtime`
- `DELETE /api/features/runtime`
- `POST /api/run`
- `GET /api/debug/registry`

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

Browser UI for creating, editing, running, and inspecting tools, plus a feature studio and a Zustand-backed live app runtime.

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

## Roadmap

### Phase 1: richer tool contracts

- [x] input schemas
- [x] output schemas
- [x] tool-to-tool calls
- [ ] tool tests / fixtures
- [ ] better output validation at save or run time

### Phase 2: generated backend APIs

- [ ] add generated API/action definitions on top of tools
- [ ] expose stable query and mutation endpoints for the frontend
- [ ] generate typed request/response contracts from schemas

### Phase 3: generated features and frontend runtime

- [x] define an initial feature metadata shape where model, actions, and views are generated together
- [x] add a Zustand-backed live runtime for generated app state
- [x] support follow-up prompts that compile into state patches
- [ ] let features depend on generated queries and actions
- [ ] add preview routes or a component sandbox for richer generated UI

### Phase 4: generated pages and app composition

- [ ] compose components into pages
- [ ] generate route metadata and page layouts
- [ ] introduce planning that breaks one prompt into tools, APIs, components, and pages

## Notes

- This is a demo project for generated function execution, not a hardened multi-tenant platform.
- Tool definitions are persisted in a Durable Object rather than an external database.
- Workers AI is used to draft tools, components, features, and feature patches, but all of them can still be inspected and evolved manually.
- Client state is now split: tool workbench state still uses local React state, while the generated feature runtime uses Zustand. The long-term direction is to consolidate more of the app around Zustand.
- If you change bindings in `wrangler.jsonc`, rerun `npm run types`.
