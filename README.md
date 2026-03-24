# Isolate Arcade

`Isolate Arcade` is a tiny coding-challenge demo built on [Cloudflare Workers](https://developers.cloudflare.com/workers/). It has:

- a simple static frontend
- 3 JavaScript-only problems
- a Worker API for loading problems and running submissions
- execution inside [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/)

The point of this repo is not to recreate LeetCode. It is to show how you can take user-provided JavaScript, run it inside a fresh isolated Worker, and call into it quickly using Cloudflare's dynamic worker loader and RPC model.

## What This Repo Shows

- [Static Assets](https://developers.cloudflare.com/workers/static-assets/) serving the UI from `public/`
- a normal Worker in `src/index.js` handling `/api/problems` and `/api/submit`
- a [Worker Loader binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/worker-loader/) configured in `wrangler.jsonc`
- per-submission Dynamic Workers created from user code at runtime
- [RPC via `WorkerEntrypoint`](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/) so the parent Worker can call the isolate directly without going through `fetch()`/JSON plumbing

## How It Works

At a high level:

1. The browser loads the static UI from `public/index.html`.
2. The frontend requests `GET /api/problems` to fetch the 3 built-in challenges.
3. When a user clicks "Run 5 Tests", the frontend posts the selected problem ID and the submitted JavaScript to `POST /api/submit`.
4. The parent Worker builds a Dynamic Worker module from the submitted code.
5. The parent Worker loads that module through `env.LOADER.get(...)`.
6. The Dynamic Worker exposes an RPC method called `run(input)`.
7. The parent Worker calls `sandbox.run(...)` for each of the 5 test cases.
8. The Worker returns the pass/fail results plus the time spent running the tests inside the isolates.

## Why `.get()` Is Used

This demo uses `env.LOADER.get(cacheKey, ...)` instead of `load(...)`.

The cache key is based on:

- the selected problem ID
- a SHA-256 hash of the submitted code

That means if the same code is run again, Cloudflare can reuse the same loaded dynamic Worker instead of rebuilding it every time. For a demo that runs the same isolate multiple times in quick succession, that is the simplest way to show off reuse and keep the code close to the [Dynamic Workers docs](https://developers.cloudflare.com/dynamic-workers/).

## Why RPC Is Used

The Dynamic Worker exports a `WorkerEntrypoint` with a `run(input)` method, and the parent Worker calls it directly:

```js
const sandbox = worker.getEntrypoint("Solution");
const actual = await sandbox.run(test.input);
```

That avoids turning every test call into a fake HTTP request and keeps the example focused on the interesting part: dynamically loading code and executing it in an isolate.

Cloudflare RPC docs:

- [RPC (WorkerEntrypoint)](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/)

## Sandbox Model

Each submission is executed in a Dynamic Worker with:

```js
globalOutbound: null
```

This blocks outbound network access from the submitted code, which keeps the demo focused on local execution. Cloudflare documents this pattern in the Dynamic Workers egress control docs:

- [Egress control](https://developers.cloudflare.com/dynamic-workers/usage/egress-control/)

## Local Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Deploy:

```bash
npm run deploy
```

Useful Cloudflare docs:

- [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/)

## Important Files

### `wrangler.jsonc`

Defines:

- the main Worker entrypoint
- the Static Assets directory
- the Worker Loader binding
- the custom domain route

### `src/index.js`

Contains:

- the 3 built-in coding problems
- the `/api/problems` route
- the `/api/submit` route
- the runtime module source for the Dynamic Worker
- isolate timing and result formatting

### `public/app.js`

Contains:

- loading the problem list
- switching between problems
- submitting code
- rendering results and isolate timing

## Notes

- Goes without saying really, but this was 100% vibe-coded.
- This is intentionally a demo, not a production code runner.
- It only supports JavaScript.
- Test comparison is intentionally simple.
- Error handling is intentionally lightweight so the loader example stays readable.