# Generated Isolates

`Generated Isolates` is a Cloudflare-native spin on the ideas in `/Users/sean/Learning/aisdk/mutagent`.

Instead of storing dynamic tool definitions in Redis, this project now uses:

- **Durable Objects** as the strongly consistent registry for saved tools
- **Workers AI** to draft tool definitions from a plain-English description
- **Dynamic Workers** to execute each tool inside an isolated sandbox
- **A Vite + React + TypeScript SPA** for the browser UI

## Why Durable Objects instead of Redis?

The original `mutagent` project persists tool definitions in Redis so later runs can load, list, seed, and clear them.

For a Cloudflare-first version, **Durable Objects** are the closest fit because they combine:

- per-object, strongly consistent state
- simple key/value style storage APIs
- direct RPC calls from the main Worker
- no separate infrastructure to run or manage

That makes the registry feel a lot like a tiny Redis-backed tool store, but fully inside Cloudflare Workers.

Cloudflare docs used for this rewrite:

- [Workers](https://developers.cloudflare.com/workers/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Durable Object migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
- [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/)
- [Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Workers AI limits](https://developers.cloudflare.com/workers-ai/platform/limits/)

## What the app does

The app lets you:

1. describe a tool in plain English and have Workers AI draft the name, schema, example input, and source
2. create and save named JavaScript tool definitions
3. list and load saved tools from a Durable Object registry
4. seed the registry with a few sample tools inspired by `mutagent`
5. clear or delete saved tools
6. run a saved tool with JSON input inside a sandboxed Dynamic Worker

Each saved tool stores:

- `name`
- `description`
- `inputSchemaSource`
- `exampleInput`
- `executeSource`

`executeSource` must be a JavaScript **function expression** such as:

```js
;async ({ text }) => {
    return {
        text: text.toUpperCase(),
    }
}
```

## Architecture

### `src/index.ts`

Contains both the main Worker and the Durable Object class:

- `ToolRegistry` Durable Object
    - persists tool definitions with Durable Object storage
    - exposes RPC methods to list, get, save, delete, seed, and clear tools
- main Worker routes
    - `GET /api/tools`
    - `POST /api/tools`
    - `POST /api/tools/generate`
    - `GET /api/tools/:name`
    - `DELETE /api/tools/:name`
    - `POST /api/tools/seed`
    - `POST /api/tools/clear`
    - `POST /api/run`

### Dynamic Worker execution

When you run a saved tool:

1. the main Worker loads the saved tool definition from the Durable Object
2. it builds a Dynamic Worker module around `executeSource`
3. the module is cached by a hash of the source
4. the tool executes through RPC in a sandboxed isolate

The sandbox is created with:

```js
globalOutbound: null
```

so user-defined tool code cannot make outbound network requests.

## Cloudflare bindings

`wrangler.jsonc` now includes:

- a `LOADER` Worker Loader binding for Dynamic Workers
- an `AI` Workers AI binding for tool generation
- a `TOOL_REGISTRY` Durable Object binding
- a `v1` migration creating the SQLite-backed Durable Object class

## Local development

Install dependencies:

```bash
npm install
```

Generate updated Worker types after binding changes:

```bash
npx wrangler types
```

Run the Vite dev server with the Worker API and SPA together:

```bash
npm run dev
```

Build the Worker bundle and React client:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Deploy:

```bash
npm run deploy
```

## Limits to keep in mind

From the current Cloudflare docs:

- Workers memory per isolate: **128 MB**
- Workers CPU time: **10 ms free**, **up to 5 minutes paid**
- Durable Objects are single-threaded per object
- SQLite-backed Durable Objects can store up to **10 GB per object** on paid plans
- A single Durable Object has a soft limit of about **1,000 requests/sec**

If you push this further, re-check the live docs before changing the design.

## Notes

- `inputSchemaSource` is persisted as tool metadata, following the `mutagent` shape.
- The actual executable part is `executeSource`, which runs inside the Dynamic Worker sandbox.
- This is still a demo project, not a hardened multi-tenant production system.
