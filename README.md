# Trao Interview Prep Kit

This repository starts with the deterministic core of the assessment: requirement extraction, requirement-to-question coverage, schedule allocation, kit validation, and the mandatory batch entry point. It also contains a separate retrieval safety module for public web research.

## Run the tests

```bash
npm test
```

## Run the web application

```bash
npm run dev
```

Visit `http://localhost:3000`. For a production-mode local run, use `npm run build && npm start`.

The container endpoint is `GET /api/health`.

```bash
docker build -t trao-prep-kit .
docker run --rm -p 3000:3000 trao-prep-kit
```

## Batch evaluation contract

```bash
npm run evaluate -- --input cases.json --output kits.json
```

The command reads an array of `{ id, jd, company_url, days }` cases and emits the Appendix B wrapper shape. It continues when one case fails.

Try the included representative case:

```bash
npm run evaluate -- --input examples/cases.json --output kits.json
```

## Retrieval safety module

`src/retrieval.mjs` is deliberately isolated from generation and UI logic. Before a page can be read, it:

- permits only absolute `http` and `https` URLs;
- rejects credentials, localhost names, and private-network IP ranges;
- resolves DNS and rejects targets that resolve to a private address;
- checks `robots.txt`, uses short timeouts, rejects redirects, and caps response sizes;
- accepts only HTML or plain-text responses and reduces them to bounded text.

This is an application-side safety baseline. A production deployment should also apply outbound-network policy at the infrastructure layer.

## Research and generation pipeline

The app keeps the pipeline deliberately sequential and inspectable:

1. Extract stable requirement IDs from the job description.
2. Retrieve the supplied company page and select at most four high-signal same-origin pages, such as Careers, About, Culture, or Values.
3. Preserve every retrieved page as a dated source citation; partial retrieval failures appear in the audit object instead of failing the kit.
4. Generate category-aware questions from requirements and the retrieved company context.
5. Run a separate deterministic coverage pass that adds a repair question for every uncovered must-have requirement.

The current generator is deterministic so tests and batch output remain reproducible without secrets. `src/generation.mjs` is the provider boundary for replacing it with an LLM-backed implementation later; keep the coverage pass deterministic even after doing so.

## Local accounts and persistence

The development adapter stores hashed passwords, opaque session-token hashes, and private kits in `data/store.json`. This lets the local demo demonstrate login, ownership checks, and saved-kit editing without a hosted database. It is not suitable for serverless deployment because local disks are ephemeral. Replace `src/storage.mjs` with a database-backed adapter before deploying. Set `TRAO_COOKIE_SECURE=true` only when the deployment is served over HTTPS; keep it unset for `http://localhost` development.

The builder supports editing, adding, deleting, moving, pinning, and privately saving questions. Its current deterministic rebuild action preserves pinned and edited questions and resets only untouched generated questions.

## Deliberate next modules

The next implementation steps are separate research/generation passes, persistence, the Next.js builder UI, practice mode, and deployment. The deterministic pieces are intentionally kept separate from external retrieval and model calls.
