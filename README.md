# Trao Interview Prep Kit

An interview-preparation workspace that turns a job description and company URL into an editable, requirement-linked practice kit. It keeps the critical planning rules deterministic while allowing Gemini generation when a key is configured.

## Technology choices

The preferred stack is Next.js/Tailwind, Node/Express, and MongoDB. This implementation uses the preferred Next.js and Tailwind frontend, while Next.js route handlers provide the Node backend within the same deployment rather than a separate Express service. Supabase Postgres replaces MongoDB because the application needs relational ownership boundaries between users, sessions, and kits, and it remains available on a free tier. Both substitutions are equivalent technologies permitted by the brief.

## What it does

- Extracts stable requirement IDs from a job description and classifies them as `must` or `nice`.
- Safely retrieves the supplied company website, then follows a small set of high-signal same-origin pages.
- Builds a cited company brief, requirement-linked technical and behavioural prompts, flashcards, and an exact daily schedule.
- Performs a second coverage pass so every must-have requirement has a question and a scheduled practice slot.
- Lets a signed-in user save private kits; questions and flashcards can be edited, reordered, added, deleted, and pinned.
- Supports single-category question regeneration while preserving pinned, edited, and custom prompts.
- Runs a one-card practice loop: reveal an answer, rate confidence, and revisit weak or uncovered cards first.
- Provides the required batch evaluator, returning one result per case even when retrieval for a case fails.
- Accepts a JSON or CSV file of role cases in the browser and builds each role independently, reporting per-case success or failure.
- Shows visible input, research, and generation states, plus clear recoverable error messages.

## Architecture

```text
Browser UI
  -> Next.js API routes
    -> shared buildKit pipeline
       -> requirement extraction -> company research -> question generation
       -> deterministic coverage repair -> schedule allocation -> validation
    -> local file-store adapter (development only)
```

`src/pipeline.mjs` is the shared entry point used by both the browser API and `npm run evaluate`. That keeps the interactive path and batch path on the same generation, research, coverage, and validation rules.

### Research safety

`src/retrieval.mjs` accepts only public HTTP(S) targets. It rejects credentials, loopback/private addresses, unsafe DNS results, redirects, oversized payloads, and unsupported content types. It also respects `robots.txt`, uses bounded timeouts, rate limits page fetches, and retries transient failures with backoff. Failed pages are recorded in the audit rather than failing the whole kit.

### Generation

The deterministic generator is always available and is the fallback if Gemini is not configured or gives an invalid result. With `GEMINI_API_KEY` set, `src/ai-generation.mjs` requests schema-shaped technical and behavioural prompt drafts, validates every result against existing requirement IDs, and retains deterministic coverage repair as the final correctness guard.

The model adapter is deliberately isolated in `src/llm.mjs`, with timeout and transient-error retry handling. Retrieved page text is treated as untrusted context in prompts.

## Local setup

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
npm test
npm run build
npm start
```

Open `http://localhost:3000`.

`npm start` runs the standalone production build. The build script copies static assets into the standalone folder, so use `npm run build` again after code changes before restarting it.

For faster development you may use `npm run dev`.

## Optional Gemini configuration

Create a Gemini API key in Google AI Studio and place it in `.env.local`; do not commit the file or paste the key into the application.

```bash
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash
```

Without a key, kit generation remains functional using deterministic prompt templates. `TRAO_COOKIE_SECURE=false` is appropriate for local HTTP development; set it to `true` only for HTTPS deployment.

## Batch evaluator

```bash
npm run evaluate -- --input examples/cases.json --output kits.json
```

Input is an array of `{ id, jd, company_url, days }` objects. Output follows the required wrapper shape:

```json
{ "results": [{ "id": "case-id", "status": "ok", "kit": {} }] }
```

The evaluator continues past bad cases and writes an error object for failures. It permits local test URLs only through its explicit evaluator option; the browser route stays protected from private-network targets.

## Tests

```bash
npm test
```

The test suite covers requirement extraction, must-have coverage, schedule allocation, malformed input, retrieval safety, research failure handling, local privacy boundaries, Gemini response validation/retry behavior, and the shared pipeline.

## Current limitations and next deployment step

The local file store (`data/store.json`) is intentionally a development adapter. It stores password hashes and opaque session-token hashes, but it is not suitable for a serverless or multi-instance deployment because local disks are ephemeral. Before publishing, replace `src/storage.mjs` with a managed database adapter and deploy the Next.js service with persistent storage.

The application currently researches company-owned pages. Public interview-discussion search is a separate source type that still needs a configured search provider and its own citation/audit adapter. No public deployment is included in this repository yet.

### Hosted persistence with Supabase

The repository now includes an optional Supabase REST adapter. To enable it:

1. Create a Supabase project and run [`db/supabase-schema.sql`](db/supabase-schema.sql) in its SQL editor.
2. Add the project URL and **server-only** service-role key to `.env.local` for local use, or to the deployment provider's encrypted environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
```

3. Keep both values out of Git and out of browser-exposed variables. When both are configured, the server automatically chooses the Supabase store; otherwise it keeps using the local file store.

The service-role key is used only inside Next.js route handlers. Row-level security remains enabled on the tables as a defensive default; browser clients never access the tables directly.

## Docker

```bash
docker build -t trao-prep-kit .
docker run --rm -p 3000:3000 trao-prep-kit
```

The health endpoint is `GET /api/health`.
