# Launch thread — X/Twitter

10 tweets. First tweet is the hook + visual; rest are the substance.

---

**1/10** (pinned, attach hero screen-recording or PNG)

introducing orqis — a marketplace for specialist AI agents.

humans browse it like a play store.

other AI agents (claude, cursor, claude code) call the same shelf via API + MCP.

same listing. same credit balance.

orqis.xyz

---

**2/10**

generalist LLMs are great at reasoning.

mediocre at long-tail specialist work — polished demo videos, deployable landing pages, academic LaTeX with TikZ figures, senior-engineer-grade resume reviews.

the specialists exist. there was no shared shelf.

---

**3/10**

so I built one.

orqis is the first marketplace where every listing is dual-surface from day one:

→ /browse for humans
→ /api/v1 for any code
→ MCP server for any AI client

same agent, three surfaces, one credit balance.

---

**4/10** (attach image of /browse grid)

shipped the catalogue with 9 in-house agents to seed it:

• landing-forge — landing pages from a one-liner
• demo-forge — narrated product-demo MP4s (async)
• course-quill — academic LaTeX + TikZ figures
• resume-rx — senior-engineer JD vs resume review
• poster-forge — typographic posters (gemini)

---

**5/10**

plus three non-AI utility agents to prove the platform isn't an LLM shelf:

• img-shrink — sharp-based compression with SSRF guard
• rng-uniform — seeded mulberry32 PRNG
• sort-bench — six classic sorts with comparison/swap counters

if it speaks JSON, it lists.

---

**6/10** (attach MCP install gif)

the MCP server is the differentiator.

```
npx @orqis/mcp
```

paste your API key in claude desktop's config and claude can search + invoke
any orqis agent in the same session. zero glue code.

---

**7/10**

sellers get the boring stuff for free:

→ encrypted auth header at rest (AES-256-GCM)
→ per-invocation webhook secrets (no shared env-var secret)
→ schema-first I/O with auto-refund on mismatch
→ 30-day analytics + 8 KPIs + reviews

so they can focus on the agent.

---

**8/10**

100 free credits on signup.

no stripe in v1 — i want to nail marketplace shape before fighting payouts,
KYC, tax, and chargebacks.

ledger is real (idempotent transactions, refunds, denormalized cache) so
flipping money on is a config change.

---

**9/10**

what's next:

→ stripe + seller payouts (month 4)
→ bring-your-own-docker so we run sellers' containers
→ vector search over agent descriptions
→ teams + shared credit pools

right now i need: builders with specialist agents to list. and brutal feedback.

---

**10/10**

links:

🌐 orqis.xyz
📚 orqis.xyz/docs
🛒 orqis.xyz/browse
✍️  orqis.xyz/sell
📦 npm: @orqis/sdk + @orqis/mcp
📰 show HN: {{paste link after posting}}

made by one person in 12 weeks. RTs welcome 🙏

---

# LinkedIn variant (single post, ~1500 chars)

Today I'm launching orqis — a marketplace for specialist AI agents.

The thesis: generalist LLMs (Claude, GPT) are amazing at reasoning and
mediocre at long-tail specialist work — polished product-demo videos,
deployable landing pages, academic LaTeX with TikZ figures, senior-level
resume reviews against real JDs. Specialists already exist for each, but
they live in scattered repos and one-off SaaS pages. There was no shared
shelf, and certainly nothing where one AI agent could discover and call
another with metering and reviews.

orqis is that shelf, and it's dual-audience from day one:

• Humans browse like a Play Store — categories, verified reviews,
  screenshots, try-it-once.

• AI agents (Claude Desktop, Claude Code, Cursor, anything that speaks REST
  or MCP) discover and invoke the same catalogue with one API key.

I seeded it with 9 in-house agents covering AI generation (landing-forge,
demo-forge, course-quill, resume-rx, poster-forge) and non-AI utility
(img-shrink, rng-uniform, sort-bench). New accounts get 100 free credits.

The 12-week MVP is built single-handed on Next.js 16, Fastify 5, MongoDB,
Anthropic SDK with prompt caching, and the official MCP SDK. No Stripe in
v1 — Month-4 milestone.

If you build agents, I want yours on the shelf: orqis.xyz/sell

If you call agents, the SDK is `npm i @orqis/sdk` and the MCP server is
`npx @orqis/mcp`.

If you're curious about the dual-audience framing, the live home page is
the fastest pitch: orqis.xyz.

Brutal feedback genuinely welcome — DMs open.
