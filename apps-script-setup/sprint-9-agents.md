# orqis — Sprint 9: course-quill + resume-rx

Two more in-house agents ride the existing pipelines:

- **resume-rx** (sync, 8 credits) — uses the same Sprint-7 sync stack as
  landing-forge. Real Anthropic with `client.messages.parse()` + Zod schema,
  prompt caching on the long rubric system prompt, `pdf-parse` for PDF resumes,
  SSRF-guarded JD URL fetching.
- **course-quill** (async, 30 credits) — uses the Sprint-8 async runtime
  (charge → seller acks 202 → background work → webhook → polling UI).
  Mock-only for Sprint 9 (the `tectonic` LaTeX compiler is a system-install
  on Windows; real mode is stubbed with a TODO).

No new env vars. Reseed + run both apps.

## Reseed

```bash
cd orqis-frontend && npm run seed
```

You should see `course-quill (updated)` and `resume-rx (new)` (the seed entry was
added in Sprint 7's planning push; this sprint just wires the endpointUrl).

## Try resume-rx (sync)

Sign in → **/agents/resume-rx** → Run with the seed example (a thin Acme Infra
resume targeting a staff role). In **mock mode** (default) you'll get a canned
"no-hire" recommendation back instantly. In **real mode** (set `ANTHROPIC_API_KEY`
to a real key in `orqis-backend/.env`, restart) you'll get a real per-section
breakdown with actual rewrite suggestions for the resume you submit.

PDF support: pass `resumeFormat: "pdf"` and a base64-encoded PDF (with or without
the `data:application/pdf;base64,` prefix). `pdf-parse` extracts the text before
sending to Claude.

JD support: `jobDescription` accepts plain text **or** an `https://` URL —
URLs are fetched (10s timeout, 200 KB cap, SSRF-guarded against private IPs)
and HTML-stripped before being passed to the model. The orqis frontend
invocation proxy already validates the input shape; the backend route does
the URL fetch.

PII redaction: pass `redactPii: true` to zero out emails + phone numbers in the
returned `summary` and `markdownReport`. Useful when piping the report into a
shared doc.

Prompt caching: the long system prompt (rubric + ATS heuristics + tone rules) is
cached. The first call writes the cache (~1.25× cost on those tokens), every
subsequent call reads it (~10% cost). Verify via the `meta.cacheReadTokens`
field in the response — should be > 0 from the second call onwards.

## Try course-quill (async)

**/agents/course-quill** → Run. Same pending-card → 8s wait → success-card flow
as demo-forge. The mock "PDF" is the original *Attention is All You Need*
arXiv paper — you'll see it render inline in the iframe preview.

To enable the real LaTeX pipeline later (Anthropic for content + `tectonic`
shell-out for compilation):

1. Install `tectonic` on the host: <https://tectonic-typesetting.github.io/install.html>
2. Set `LATEX_PIPELINE=real` in `orqis-backend/.env` and restart.
3. Note: requires a fair amount of disk for the cached LaTeX packages on first run.

## Production notes

- **resume-rx** real-mode cost: roughly 1 Sonnet 4.6 call per request,
  cached after the first. Budget ~$0.01 per invocation on average inputs.
- **course-quill** real-mode cost: depends on page count. ~5 Sonnet calls
  for an 8-page paper + diagrams. Budget ~$0.05 per invocation.
- **Local PDF storage** — both agents currently write to `orqis-backend/storage/r/`.
  Swap to R2 with the same one-file change planned for landing-forge.
- **JD fetching from external URLs** is a tiny SSRF surface — only http(s),
  blocks private IPs across v4+v6, 10s timeout, 200 KB cap. Same defense
  used by img-shrink. Reuse the helper if you ever need to fetch arbitrary
  URLs from another agent.
