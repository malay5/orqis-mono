/**
 * Hand-crafted founding agents that seed the marketplace before real sellers
 * onboard. Used by:
 *   - scripts/seed.ts          → upserts these into MongoDB
 *   - app/browse/page.tsx      → falls back to this list when the DB is empty
 *   - app/agents/[slug]/page.tsx → likewise
 *
 * Treat this file as design data, not as runtime config — once real agents
 * exist in the DB we'll stop reading from here.
 */

export type SeedAgent = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  longDescription: string;
  category: string;
  tags: string[];
  iconEmoji: string;
  accentHex: string;
  screenshots: string[]; // captions; rendered as gradient mock tiles
  pricePerCall: number; // credits
  isAsync: boolean;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  exampleRequest: Record<string, unknown>;
  exampleResponse: Record<string, unknown>;
  ratingAverage: number;
  ratingCount: number;
  invocationCount: number;
  // Every seed agent now has a real endpoint (Sprint 18 — display-only stubs
  // were deleted). Kept optional for forward compat with externally-submitted
  // listings that may be inserted with an empty endpoint while pending review.
  endpointUrl?: string;
};

export const SEED_AGENTS: SeedAgent[] = [
  {
    slug: "demo-forge",
    name: "demo-forge",
    tagline: "30-second narrated product demos from a URL.",
    description:
      "Give it a URL or product description and demo-forge returns a polished MP4 demo with voiceover, scene-cut animations, and captions. The flagship in-house orqis agent.",
    longDescription:
      "demo-forge takes the marketing brief out of the loop. It crawls your URL, drafts a six-scene script, generates a voiceover with the voice of your choice, animates each scene as Tailwind-styled slides, and renders the whole thing as an MP4 with synced captions.\n\nUse it for: product launches, hackathon demos, fundraising teasers, App-Store preview reels.\n\nUnder the hood: Claude for the script, ElevenLabs for the voice, Remotion for the render. Output is delivered as a signed R2 URL within ~2 minutes.",
    category: "Video",
    tags: ["product demo", "video", "voiceover", "remotion"],
    iconEmoji: "🎬",
    accentHex: "#a855f7",
    screenshots: ["Scene storyboard", "Voiceover preview", "Final 30s render"],
    pricePerCall: 50,
    isAsync: true,
    inputSchema: {
      type: "object",
      required: ["product"],
      properties: {
        product: {
          type: "string",
          description: "Product URL to crawl OR a free-text product description.",
        },
        durationSeconds: { type: "number", enum: [15, 30, 60], default: 30 },
        voice: { type: "string", default: "alloy", enum: ["alloy", "onyx", "nova", "shimmer"] },
        style: { type: "string", default: "minimal", enum: ["minimal", "bold", "playful"] },
      },
    },
    outputSchema: {
      type: "object",
      required: ["previewUrl"],
      properties: {
        previewUrl: {
          type: "string",
          format: "uri",
          description: "MP4 URL — TryItPanel detects this and embeds a video preview.",
        },
        posterUrl: { type: "string", format: "uri" },
        captionsVttUrl: { type: "string", format: "uri" },
        scriptMarkdown: { type: "string" },
        modelUsed: { type: "string" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: { product: "https://linear.app", durationSeconds: 30, voice: "nova" },
    exampleResponse: {
      previewUrl: "http://localhost:4000/r/8c1f.mp4",
      scriptMarkdown: "# Linear\n\nThe issue tracker for modern teams…",
      modelUsed: "claude+elevenlabs+remotion",
      durationMs: 132_000,
    },
    ratingAverage: 4.9,
    ratingCount: 38,
    invocationCount: 612,
    endpointUrl: "http://localhost:4000/v1/agents/demo-forge/run",
  },
  {
    slug: "course-quill",
    name: "course-quill",
    tagline: "Academic coursework + Beamer slides in real LaTeX.",
    description:
      "Pick a topic, course level, and page count. course-quill produces a real .tex source, a compiled PDF, and a matching Beamer slide deck. Diagrams are TikZ / pgfplots — vector, citable, editable. No AI image gen (a deliberate choice for academic content).",
    longDescription:
      "course-quill is built for the educator who is sick of formatting and just wants the content right.\n\nGive it a topic and a level (intro / intermediate / advanced) and it produces an outlined paper with placeholder citations, equations typeset properly, vector diagrams via TikZ + pgfplots, and a Beamer slide deck that mirrors the section structure.\n\nA deliberate non-feature: no AI-generated illustrative images. Academic content needs labelled, citable, edit-able figures — generic 'abstract neural network' renders are a category mistake here. course-quill emits TikZ source for diagrams (which you can tweak in Overleaf) and leaves explicit \\figure{} slots for any photos you want to drop in yourself.\n\nReturns: PDF + .tex source + Beamer .pdf in a single zip, all clean enough to open in Overleaf and keep editing.",
    category: "Education",
    tags: ["latex", "education", "slides", "pdf", "tikz", "academic"],
    iconEmoji: "📐",
    accentHex: "#06b6d4",
    screenshots: ["PDF preview", "Beamer slide", "Source .tex"],
    pricePerCall: 30,
    isAsync: true,
    inputSchema: {
      type: "object",
      required: ["topic"],
      properties: {
        topic: { type: "string" },
        courseLevel: { type: "string", enum: ["intro", "intermediate", "advanced"], default: "intro" },
        pageCount: { type: "number", minimum: 2, maximum: 30, default: 8 },
        format: { type: "string", enum: ["paper", "beamer-slides", "both"], default: "both" },
        includeTikzDiagrams: {
          type: "boolean",
          default: true,
          description: "Emit TikZ / pgfplots source for any diagrams the topic warrants. Vector, citable, editable in Overleaf.",
        },
        equationDensity: {
          type: "string",
          enum: ["sparse", "balanced", "heavy"],
          default: "balanced",
          description: "How math-forward the writing should be.",
        },
        citationStyle: {
          type: "string",
          enum: ["acm", "ieee", "apa", "none"],
          default: "acm",
          description: "Citation style. We emit \\cite{} placeholders; you populate the .bib.",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["previewUrl"],
      properties: {
        previewUrl: {
          type: "string",
          format: "uri",
          description: "Same as pdfUrl — TryItPanel detects this and embeds an inline PDF preview.",
        },
        pdfUrl: { type: "string", format: "uri" },
        slidesPdfUrl: { type: "string", format: "uri" },
        sourceZipUrl: { type: "string", format: "uri" },
        tikzFigureCount: { type: "integer" },
      },
    },
    exampleRequest: {
      topic: "Introduction to graph neural networks",
      courseLevel: "intermediate",
      pageCount: 8,
      format: "both",
      includeTikzDiagrams: true,
      equationDensity: "balanced",
      citationStyle: "acm",
    },
    exampleResponse: {
      previewUrl: "https://orqis.xyz/r/gnn.pdf",
      pdfUrl: "https://orqis.xyz/r/gnn.pdf",
      slidesPdfUrl: "https://orqis.xyz/r/gnn-slides.pdf",
      sourceZipUrl: "https://orqis.xyz/r/gnn.zip",
      tikzFigureCount: 5,
    },
    ratingAverage: 4.7,
    ratingCount: 22,
    invocationCount: 287,
    endpointUrl: "http://localhost:4000/v1/agents/course-quill/run",
  },
  // ---------------------------------------------------------------------
  // resume-rx (Sprint 9) — in-house resume evaluator. The reference seed
  // for what a deeply-spec'd specialist agent looks like on orqis: every
  // input is documented, every output field has a purpose. No backend yet
  // (lands Sprint 9); the listing exists today so /browse + the schema
  // viewer + reviews can be tested against it.
  // ---------------------------------------------------------------------
  {
    slug: "resume-rx",
    name: "resume-rx",
    tagline: "Senior-engineer-grade resume review against any role.",
    description:
      "Paste a resume + the job description you're targeting. Get back a structured evaluation: ATS pass/fail, keyword gaps, per-section scores, red-flag detection, and rewrite suggestions for the weakest lines.",
    longDescription:
      "resume-rx is the resume reviewer you wish you had a senior engineer friend for.\n\nIt takes a resume (plain text or PDF), a job description (text or URL), and a few opinionated knobs — target seniority, evaluation mode, tone — and produces a structured evaluation that's actionable, not generic.\n\nThe two evaluation modes:\n\n• **ats** — simulates a modern Applicant Tracking System. Parses the resume the way an ATS would, scores keyword coverage against the JD, flags formatting that breaks parsers (text in images, two-column layouts, exotic fonts).\n\n• **human** — simulates a hiring manager / staff engineer reading the resume cold. Calls out vague impact bullets ('improved performance' with no number), weak action verbs, missing context, mismatched seniority signals, padded experience.\n\nDefault mode is **both**, weighted 30% ATS + 70% human, because in practice an ATS pass is necessary-but-not-sufficient for actually getting an interview.\n\nReturns a recommendation (`strong-hire` / `hire` / `no-hire` / `strong-no-hire`), per-section scores, top strengths, weaknesses, red flags, missing JD keywords, and concrete rewrite suggestions for the weakest 3-5 lines.\n\nNo PII storage: resumes are evaluated in-flight and dropped. Pass `redactPii=true` if you want emails, phone numbers, and addresses zeroed out in the response too.",
    category: "GTM",
    tags: ["resume", "hiring", "evaluation", "ats", "career"],
    iconEmoji: "🧪",
    accentHex: "#a855f7",
    screenshots: [
      "Overall recommendation card",
      "Per-section scoring breakdown",
      "Rewrite suggestions diff",
      "Keyword-gap heatmap vs JD",
    ],
    pricePerCall: 8,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["resume"],
      properties: {
        resume: {
          type: "string",
          description:
            "Resume content — either plain-text (UTF-8) OR a base64-encoded PDF (with or without the `data:application/pdf;base64,` prefix; max 5 MB). The agent detects which it is from the content.",
        },
        resumeFormat: {
          type: "string",
          enum: ["text", "pdf"],
          default: "text",
          description: "Tells us how to interpret the `resume` field.",
        },
        jobDescription: {
          type: "string",
          description:
            "The role you're targeting. Either pasted text or an https URL we'll fetch. Optional but unlocks ATS keyword scoring + JD-aware rewrite suggestions.",
        },
        targetRole: {
          type: "string",
          description:
            "One-line description of the target role, e.g. 'Senior Backend Engineer at a Series B fintech'. Used as a fallback when no full JD is provided.",
        },
        targetSeniority: {
          type: "string",
          enum: [
            "intern",
            "junior",
            "mid",
            "senior",
            "staff",
            "principal",
            "manager",
            "director",
          ],
          description:
            "What level the candidate is *applying for*. We weight feedback against this — a senior resume judged for a staff role gets pushed harder on scope and ownership.",
        },
        industryHint: {
          type: "string",
          description:
            "Free-text industry context, e.g. 'developer tools', 'healthtech', 'enterprise SaaS'. Helps tune which signals matter.",
        },
        evaluationMode: {
          type: "string",
          enum: ["ats", "human", "both"],
          default: "both",
          description:
            "ats = simulate an Applicant Tracking System; human = simulate a hiring manager reading cold; both = run both and aggregate (30% ATS + 70% human).",
        },
        rubricFocus: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "experience",
              "skills",
              "education",
              "leadership",
              "communication",
              "achievements",
              "technical-depth",
              "ownership",
              "career-progression",
            ],
          },
          description:
            "Which dimensions to score in detail. Default is all of them; trim the list to focus the report.",
        },
        redLines: {
          type: "array",
          items: { type: "string" },
          description:
            "Hard dealbreakers, e.g. 'no AWS experience', 'requires US work auth'. We surface these prominently in the report.",
        },
        tone: {
          type: "string",
          enum: ["blunt", "constructive", "encouraging"],
          default: "constructive",
          description:
            "How harshly to phrase weaknesses. 'blunt' is for the candidate themselves; 'encouraging' is for sharing with someone whose feelings you'd like to spare.",
        },
        outputFormat: {
          type: "string",
          enum: ["json", "markdown", "both"],
          default: "both",
          description:
            "json = structured fields; markdown = pre-rendered review document; both = receive both side by side.",
        },
        includeRewriteSuggestions: {
          type: "boolean",
          default: true,
          description: "Per-line rewrites for the weakest 3-5 bullets, with reasons.",
        },
        includeKeywordGaps: {
          type: "boolean",
          default: true,
          description: "Required only if jobDescription is provided.",
        },
        includeAtsBreakdown: {
          type: "boolean",
          default: true,
          description:
            "Detailed ATS scoring: format issues, parseability, section detection, keyword coverage.",
        },
        includeRedFlags: {
          type: "boolean",
          default: true,
          description:
            "Surfaces things hiring managers worry about: short tenures, gaps, title inflation, vague impact.",
        },
        redactPii: {
          type: "boolean",
          default: false,
          description:
            "Zero out email, phone, and address fields in the response. Useful when piping the report into a shared doc.",
        },
        language: {
          type: "string",
          default: "en",
          description:
            "BCP-47 language tag for the resume. Default is English; pass e.g. 'es' or 'de' for non-English resumes.",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["overallScore", "recommendation", "summary"],
      properties: {
        overallScore: {
          type: "number",
          minimum: 0,
          maximum: 100,
          description:
            "Aggregate score combining ATS + human evaluation per the configured weighting.",
        },
        recommendation: {
          type: "string",
          enum: ["strong-hire", "hire", "no-hire", "strong-no-hire"],
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "How sure we are about the recommendation, given the inputs provided.",
        },
        summary: {
          type: "string",
          description: "One paragraph executive summary suitable for sharing.",
        },
        ats: {
          type: "object",
          properties: {
            score: { type: "number", minimum: 0, maximum: 100 },
            compatible: { type: "boolean" },
            issues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  severity: { type: "string", enum: ["low", "medium", "high"] },
                  area: {
                    type: "string",
                    enum: [
                      "format",
                      "parseability",
                      "sections",
                      "keywords",
                      "length",
                      "contact",
                    ],
                  },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        sectionScores: {
          type: "object",
          additionalProperties: { type: "number", minimum: 0, maximum: 100 },
          description:
            "Map of rubric dimension → 0-100 score. Keys come from rubricFocus.",
        },
        strengths: { type: "array", items: { type: "string" } },
        weaknesses: { type: "array", items: { type: "string" } },
        redFlags: { type: "array", items: { type: "string" } },
        keywordGaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              keyword: { type: "string" },
              importance: { type: "string", enum: ["nice-to-have", "preferred", "required"] },
              presentInResume: { type: "boolean" },
            },
          },
        },
        rewriteSuggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              section: { type: "string" },
              before: { type: "string" },
              after: { type: "string" },
              reason: { type: "string" },
            },
          },
        },
        nextSteps: { type: "array", items: { type: "string" } },
        markdownReport: { type: "string" },
        meta: {
          type: "object",
          properties: {
            modelUsed: { type: "string" },
            generatedInMs: { type: "number" },
            jdSource: { type: "string", enum: ["text", "url", "none"] },
            piiRedacted: { type: "boolean" },
          },
        },
      },
    },
    exampleRequest: {
      resume:
        "ADA LOVELACE\nada@example.com · linkedin.com/in/adalovelace\n\nEXPERIENCE\nSenior Backend Engineer · Acme Infra · 2022-present\n· Worked on the platform team\n· Improved performance of the API\n· Led migrations\n\nJunior Engineer · Beta Co · 2019-2022\n· Built features\n· Wrote tests\n\nEDUCATION\nBSc Computer Science · MIT · 2019\n\nSKILLS\nGo, Python, Postgres, Kubernetes",
      resumeFormat: "text",
      jobDescription:
        "We're hiring a Staff Engineer for our Platform team. You'll own the request-path infrastructure that handles 50k req/s, mentor 4-6 senior engineers, and define our migration off Kafka. Required: deep Go, Postgres at scale, leading multi-quarter projects.",
      targetSeniority: "staff",
      industryHint: "developer tools",
      evaluationMode: "both",
      tone: "constructive",
      includeRewriteSuggestions: true,
    },
    exampleResponse: {
      overallScore: 58,
      recommendation: "no-hire",
      confidence: 0.82,
      summary:
        "Strong technical foundation but resume is dramatically under-leveled for the staff role. Bullets describe activity, not impact — 'improved performance' without a number, 'led migrations' without scope. Three concrete rewrites would lift this 15+ points.",
      ats: {
        score: 78,
        compatible: true,
        issues: [
          {
            severity: "low",
            area: "keywords",
            message: "Missing JD keywords: 50k req/s, mentorship, Kafka migration.",
          },
        ],
      },
      sectionScores: {
        experience: 52,
        "technical-depth": 68,
        ownership: 41,
        leadership: 38,
        achievements: 35,
        "career-progression": 70,
      },
      strengths: [
        "Clean, parseable formatting — no ATS hazards.",
        "Career arc shows progression (Junior → Senior at a credible infra company).",
        "Skills list aligns with JD's required stack.",
      ],
      weaknesses: [
        "Every bullet describes activity, not measurable impact.",
        "No mention of mentorship or cross-team work — both required for staff.",
        "JD asks about Kafka migration; resume doesn't reference message systems at all.",
      ],
      redFlags: [
        "3 years at Acme without a promotion — at staff target this needs explanation.",
      ],
      keywordGaps: [
        { keyword: "50k req/s scale", importance: "required", presentInResume: false },
        { keyword: "mentorship", importance: "required", presentInResume: false },
        { keyword: "Kafka", importance: "required", presentInResume: false },
      ],
      rewriteSuggestions: [
        {
          section: "Experience · Acme Infra",
          before: "Improved performance of the API",
          after:
            "Cut p99 API latency from 240ms to 90ms by introducing connection pooling and read replicas; sustained gains across 4 quarterly load tests.",
          reason:
            "Gives the staff-level signals the JD asks for: numbers, durability, scope.",
        },
        {
          section: "Experience · Acme Infra",
          before: "Led migrations",
          after:
            "Led a 9-month Kafka → Redpanda migration spanning 6 services and 4 teams; hit zero-downtime cutover with 30% lower cost.",
          reason:
            "Directly addresses the JD's 'define our migration off Kafka' line.",
        },
      ],
      nextSteps: [
        "Rewrite the top 3 bullets with measurable impact.",
        "Add a Mentorship line: who, how many, what they shipped.",
        "If you've worked with message queues at all, surface it explicitly.",
      ],
      markdownReport: "## Resume Evaluation: Ada Lovelace\n\n…",
      meta: {
        modelUsed: "claude-sonnet-4-6",
        generatedInMs: 6240,
        jdSource: "text",
        piiRedacted: false,
      },
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/resume-rx/run",
  },

  // ---------------------------------------------------------------------
  // poster-forge (Sprint 10) — in-house. THIS is where AI image gen
  // belongs: posters are creative output, not academic content. Uses
  // Gemini's image model (codename "nano banana", currently exposed as
  // gemini-2.5-flash-image-preview / similar — confirm exact model id at
  // sprint start).
  // ---------------------------------------------------------------------
  {
    slug: "poster-forge",
    name: "poster-forge",
    tagline: "Event posters and key art via Gemini's nano-banana image model.",
    description:
      "Title, subtitle, a few details, and a vibe. Get back a high-resolution poster — multiple aspect ratios, real typography baked in, no Canva account required.",
    longDescription:
      "poster-forge generates event posters, key art, and social-card images from a structured brief. Pipeline: Claude drafts the typographic + compositional plan (hierarchy, fonts, layout grid), Gemini's image model renders the artwork at the requested aspect ratio, and we composite the title text on top with real font rendering (image models still don't reliably render long titles).\n\nUse cases: meetup announcements, conference key art, club night posters, product-launch hero images, podcast cover art, social cards.\n\nNon-use cases: photorealistic product shots (try hero-shot), academic figures (try course-quill's TikZ output), brand logos (image gen is bad at consistent vector marks).",
    category: "Image",
    tags: ["poster", "image", "key-art", "gemini", "nano-banana"],
    iconEmoji: "🪧",
    accentHex: "#ec4899",
    screenshots: ["A4 portrait", "Square social", "Wide banner"],
    pricePerCall: 18,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["title", "vibe"],
      properties: {
        title: {
          type: "string",
          maxLength: 80,
          description: "The headline. Composited as real text after the image renders.",
        },
        subtitle: {
          type: "string",
          maxLength: 140,
          description: "Optional supporting line. Kept short — long subtitles fight the art.",
        },
        eventDetails: {
          type: "string",
          maxLength: 240,
          description: "Date, venue, lineup, ticket URL, etc. Composited as a small text block.",
        },
        vibe: {
          type: "string",
          description:
            "One paragraph describing the mood, era, references. e.g. 'late-90s rave flyer, neon on black, photocopied texture'.",
        },
        aspectRatio: {
          type: "string",
          enum: ["1:1", "4:5", "9:16", "16:9", "3:4", "2:3", "a4-portrait"],
          default: "a4-portrait",
        },
        accentHex: {
          type: "string",
          pattern: "^#[0-9a-fA-F]{6}$",
          description: "Optional brand color. Used for the title text overlay if it contrasts.",
        },
        avoid: {
          type: "array",
          items: { type: "string" },
          description: "Things the image should not include, e.g. 'people', 'text in the artwork', 'logos'.",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["previewUrl", "downloadUrl"],
      properties: {
        previewUrl: { type: "string", format: "uri" },
        downloadUrl: { type: "string", format: "uri" },
        width: { type: "integer" },
        height: { type: "integer" },
        meta: {
          type: "object",
          properties: {
            modelUsed: { type: "string" },
            generatedInMs: { type: "number" },
          },
        },
      },
    },
    exampleRequest: {
      title: "PARSE NIGHT 09",
      subtitle: "Devs · drinks · demos",
      eventDetails: "Fri 14 Mar · 19:00 · Berghain Kantine · free entry, RSVP at orqis.xyz/parse",
      vibe: "Late-90s rave flyer aesthetic. Cyan + magenta on near-black. Photocopier-grain texture. Mono terminal type referenced in the composition.",
      aspectRatio: "a4-portrait",
      accentHex: "#06b6d4",
      avoid: ["people", "logos in the artwork"],
    },
    exampleResponse: {
      previewUrl: "http://localhost:4000/r/9ac8f1e3a6204b2d.png",
      downloadUrl: "http://localhost:4000/r/9ac8f1e3a6204b2d.png",
      width: 1240,
      height: 1754,
      meta: {
        modelUsed: "gemini-2.5-flash-image",
        generatedInMs: 9420,
      },
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/poster-forge/run",
  },

  // ---------------------------------------------------------------------
  // landing-forge (Sprint 7) — orqis's first real, useful in-house agent.
  // Generates a self-contained HTML landing page from a brief. Runs against
  // claude-sonnet-4-6 (or mock mode when ANTHROPIC_API_KEY is unset / "mock").
  // Hosted on orqis-backend at /v1/agents/landing-forge/run.
  // ---------------------------------------------------------------------
  {
    slug: "landing-forge",
    name: "landing-forge",
    tagline: "Deployable landing pages from a one-paragraph brief.",
    description:
      "orqis's first in-house agent. Give it a product name + one-liner and (optionally) features, audience, tone, and brand color — get back a self-contained HTML landing page in under 30 seconds.",
    longDescription:
      "landing-forge is the fastest path from a one-line product description to a real, viewable landing page.\n\nThe pipeline: you POST a brief; we run claude-sonnet-4-6 with a prompt-cached design system (dark mode, hero-first, three-tile features, gradient accents) and structured output that's validated against a JSON schema; we save the resulting HTML to disk; and we return a public URL you can share, embed, or download.\n\nUnder the hood: Tailwind via CDN keeps the output zero-build-step. Prompt caching on the long system prompt keeps cost down — the first call writes the cache, subsequent calls read it at ~10% of the price. Structured output guarantees you get back a parseable shape every time.\n\nGreat for: founders shipping side projects, hackathon teams, designers prototyping, agencies generating first-draft pages for client review.",
    category: "Web",
    tags: ["landing page", "html", "tailwind", "in-house", "claude"],
    iconEmoji: "🪄",
    accentHex: "#6366f1",
    screenshots: ["Hero variation", "Feature grid", "Mobile view"],
    pricePerCall: 5,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["productName", "oneLiner"],
      properties: {
        productName: {
          type: "string",
          minLength: 1,
          maxLength: 80,
          description: "The product or company name shown in the hero.",
        },
        oneLiner: {
          type: "string",
          minLength: 5,
          maxLength: 240,
          description: "A single sentence describing what the product does.",
        },
        audience: {
          type: "string",
          maxLength: 200,
          description: "Who is this for? E.g. 'urban dog owners 25-40'",
        },
        features: {
          type: "array",
          items: { type: "string" },
          maxItems: 8,
          description: "3-5 short feature blurbs. Used as the hero feature grid.",
        },
        tone: {
          type: "string",
          enum: ["minimal", "bold", "playful", "premium"],
          default: "minimal",
        },
        primaryColor: {
          type: "string",
          pattern: "^#[0-9a-fA-F]{6}$",
          description: "Hex color used for accents and CTAs. Defaults to #6366f1.",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["previewUrl", "htmlDownloadUrl", "designNotes"],
      properties: {
        previewUrl: {
          type: "string",
          format: "uri",
          description: "Public URL hosting the rendered HTML. Embed in an iframe to preview.",
        },
        htmlDownloadUrl: {
          type: "string",
          format: "uri",
          description: "URL to download the raw HTML file (same as previewUrl for now).",
        },
        designNotes: {
          type: "array",
          items: { type: "string" },
          description: "Short notes explaining the design decisions.",
        },
        meta: {
          type: "object",
          properties: {
            modelUsed: { type: "string" },
            generatedInMs: { type: "number" },
            cacheReadTokens: { type: "number" },
          },
        },
      },
    },
    exampleRequest: {
      productName: "Bark",
      oneLiner: "A smart dog collar for joggers.",
      audience: "urban dog owners 25-40",
      features: ["GPS tracking", "Heart-rate monitor", "30-day battery"],
      tone: "playful",
      primaryColor: "#a855f7",
    },
    exampleResponse: {
      previewUrl: "http://localhost:4000/r/9ac8f1e3a6204b2d.html",
      htmlDownloadUrl: "http://localhost:4000/r/9ac8f1e3a6204b2d.html",
      designNotes: [
        "Used #a855f7 as the accent on hero CTA + feature icons.",
        "Tone 'playful' shaped looser headline copy and a friendlier secondary CTA.",
        "Three-tile feature grid mapping to the supplied features.",
      ],
      meta: { modelUsed: "claude-sonnet-4-6", generatedInMs: 8420 },
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/landing-forge/run",
  },

  // ---------------------------------------------------------------------
  // img-shrink (Sprint 7) — NOT an AI agent. A plain utility API that
  // resizes + recompresses images via sharp. Proves orqis is a marketplace
  // for any callable specialist, not just LLM-backed ones.
  // ---------------------------------------------------------------------
  {
    slug: "img-shrink",
    name: "img-shrink",
    tagline: "Compress and convert images to WebP / AVIF / JPEG / PNG.",
    description:
      "Not an AI agent — just a fast, useful API. Pass an image URL or base64; get back a smaller, modern-format version. Most users don't have a one-call compressor + format converter at hand. Now they do.",
    longDescription:
      "img-shrink is a sharp-powered image compressor and format converter. Bring an image (URL or base64), pick a target format and quality, get back a smaller file you can host or embed.\n\nDefaults are sensible: WebP at quality 80, max-width 1920px. Override per-call when you need lossless PNG, AVIF for hero images, or hard-cap dimensions for thumbnails.\n\nThis listing exists on orqis as a deliberate signal: the marketplace is for any callable specialist API, not just LLM-backed ones. If you have a small, sharp tool that solves a real problem, list it — buyers want utilities they don't have to build, deploy, and maintain themselves.\n\nSafety: requests with imageUrl are SSRF-guarded (private / loopback IPs are rejected) and capped at 25 MB input.",
    category: "Image",
    tags: ["image", "compression", "webp", "avif", "utility", "non-ai"],
    iconEmoji: "🗜️",
    accentHex: "#10b981",
    screenshots: ["Before / after preview", "Format options", "Compression ratio"],
    pricePerCall: 1,
    isAsync: false,
    inputSchema: {
      type: "object",
      oneOf: [{ required: ["imageUrl"] }, { required: ["imageBase64"] }],
      properties: {
        imageUrl: {
          type: "string",
          format: "uri",
          description: "https URL to the source image (max 25 MB).",
        },
        imageBase64: {
          type: "string",
          description: "Base64-encoded image bytes (raw or data: URL).",
        },
        format: {
          type: "string",
          enum: ["jpeg", "png", "webp", "avif", "auto"],
          default: "webp",
          description: "Target output format. 'auto' picks WebP unless source is already WebP/AVIF.",
        },
        maxWidth: {
          type: "integer",
          minimum: 16,
          maximum: 8192,
          default: 1920,
          description: "Cap on output width. Aspect ratio is preserved. Images smaller than this are not enlarged.",
        },
        quality: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 80,
          description: "Quality 1-100. Ignored for PNG (which is lossless; the value is mapped to compression level instead).",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["previewUrl", "downloadUrl", "outputFormat", "width", "height"],
      properties: {
        previewUrl: { type: "string", format: "uri" },
        downloadUrl: { type: "string", format: "uri" },
        inputFormat: { type: "string" },
        outputFormat: { type: "string", enum: ["jpeg", "png", "webp", "avif"] },
        width: { type: "integer" },
        height: { type: "integer" },
        originalBytes: { type: "integer" },
        outputBytes: { type: "integer" },
        compressionRatio: {
          type: "number",
          description: "outputBytes / originalBytes. 0.42 means the output is 42% of the original.",
        },
        savedBytes: { type: "integer" },
        meta: {
          type: "object",
          properties: { generatedInMs: { type: "number" } },
        },
      },
    },
    exampleRequest: {
      imageUrl: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d",
      format: "webp",
      maxWidth: 1280,
      quality: 78,
    },
    exampleResponse: {
      previewUrl: "http://localhost:4000/r/9ac8f1e3a6204b2d.webp",
      downloadUrl: "http://localhost:4000/r/9ac8f1e3a6204b2d.webp",
      inputFormat: "jpeg",
      outputFormat: "webp",
      width: 1280,
      height: 853,
      originalBytes: 488_213,
      outputBytes: 96_541,
      compressionRatio: 0.198,
      savedBytes: 391_672,
      meta: { generatedInMs: 412 },
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/img-shrink/run",
  },

  // ---------------------------------------------------------------------
  // rng-uniform — non-AI utility. Seeded uniform random numbers. Useful as
  // a real test fixture (reproducible across runs when you pass `seed`)
  // and as proof that orqis hosts plain, useful APIs alongside AI agents.
  // ---------------------------------------------------------------------
  {
    slug: "rng-uniform",
    name: "rng-uniform",
    tagline: "Seeded uniform random number generator.",
    description:
      "Pass `count`, optional `min`/`max`, optional `integer`, optional `seed`. Get back an array of numbers. Same seed → same numbers, every time. No AI, no API costs.",
    longDescription:
      "rng-uniform is a Mulberry32-backed PRNG exposed as an API. It exists for two reasons:\n\n1. **Reproducible test fixtures.** Pass an explicit `seed` and the output sequence is deterministic across runs, machines, and language clients. Drop the same call into a CI test and your assertions stay stable.\n\n2. **A signal that orqis hosts non-AI specialists too.** Same shelf as landing-forge and demo-forge, but no LLM in the loop — just one well-tested function. If you have a small, useful API, list it.\n\nWhen `seed` is omitted we generate one and return it in the response so you can replay the same draw later. `integer: true` produces inclusive integer bounds (so `min: 1, max: 6` yields a fair d6).",
    category: "Utilities",
    tags: ["random", "rng", "seeded", "utility", "non-ai"],
    iconEmoji: "🎲",
    accentHex: "#10b981",
    screenshots: ["Sequence preview", "Reproducibility check"],
    pricePerCall: 1,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["count"],
      properties: {
        count: {
          type: "integer",
          minimum: 0,
          maximum: 100000,
          description: "How many numbers to generate.",
        },
        min: { type: "number", default: 0 },
        max: { type: "number", default: 1 },
        integer: {
          type: "boolean",
          default: false,
          description: "When true, return integers and treat min/max as inclusive bounds.",
        },
        seed: {
          type: "integer",
          description:
            "Optional 32-bit seed. Same seed → same output. Omit to get a random seed (returned in the response so you can replay).",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["numbers", "count", "seed"],
      properties: {
        numbers: { type: "array", items: { type: "number" } },
        count: { type: "integer" },
        min: { type: "number" },
        max: { type: "number" },
        integer: { type: "boolean" },
        seed: { type: "integer" },
        durationMs: { type: "number" },
      },
    },
    exampleRequest: { count: 5, min: 1, max: 6, integer: true, seed: 42 },
    exampleResponse: {
      numbers: [4, 6, 1, 5, 3],
      count: 5,
      min: 1,
      max: 6,
      integer: true,
      seed: 42,
      durationMs: 0.082,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/rng-uniform/run",
  },

  // ---------------------------------------------------------------------
  // sort-bench — non-AI utility. Sort an array with a chosen algorithm,
  // count comparisons + swaps. Educational tool + a useful "I just want
  // numbers sorted" API for clients who don't want to reach for a library.
  // ---------------------------------------------------------------------
  {
    slug: "sort-bench",
    name: "sort-bench",
    tagline: "Sort numbers with the algorithm of your choice. Counts ops.",
    description:
      "Pass an array of numbers + an algorithm (bubble, insertion, selection, merge, quick, heap, native). Get back the sorted array plus the comparisons + swaps the algorithm performed. Real implementations, instrumented.",
    longDescription:
      "sort-bench is a non-AI utility that exposes six classic sort algorithms (plus the runtime's native sort for comparison) as a single API. Each algorithm is a real, production-ish implementation — bubble + insertion + selection are honest about being O(n²); merge is iterative bottom-up to avoid stack issues on large inputs; quick uses median-of-three pivoting; heap is in-place sift-down.\n\nUse cases: educational demos (compare bubble vs merge on the same input — the comparison count blows up), CI-stable test fixtures (deterministic with a fixed input), and a perfectly serviceable 'just sort these numbers' endpoint for callers who don't want to import a library.\n\nLimits: 50,000 numbers per call. Returns sorted output + algorithmUsed + comparisons + swaps + wall-clock duration.",
    category: "Utilities",
    tags: ["sort", "algorithms", "benchmark", "utility", "non-ai", "education"],
    iconEmoji: "📊",
    accentHex: "#06b6d4",
    screenshots: ["Comparison count", "Algorithm picker", "Sorted output"],
    pricePerCall: 1,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["numbers"],
      properties: {
        numbers: {
          type: "array",
          items: { type: "number" },
          maxItems: 50000,
          description: "The array to sort. Up to 50k entries.",
        },
        algorithm: {
          type: "string",
          enum: ["bubble", "insertion", "selection", "merge", "quick", "heap", "native"],
          default: "merge",
          description:
            "Which algorithm to use. `native` delegates to V8's Array.prototype.sort and reports comparisons/swaps as 0.",
        },
        reverse: {
          type: "boolean",
          default: false,
          description: "When true, reverse the sorted result (descending order).",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["sorted", "algorithmUsed", "comparisons", "swaps", "durationMs"],
      properties: {
        sorted: { type: "array", items: { type: "number" } },
        algorithmUsed: { type: "string" },
        comparisons: { type: "integer" },
        swaps: { type: "integer" },
        durationMs: { type: "number" },
        reversed: { type: "boolean" },
      },
    },
    exampleRequest: {
      numbers: [5, 2, 8, 1, 9, 3, 7, 4, 6],
      algorithm: "quick",
      reverse: false,
    },
    exampleResponse: {
      sorted: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      algorithmUsed: "quick",
      comparisons: 23,
      swaps: 14,
      durationMs: 0.045,
      reversed: false,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/sort-bench/run",
  },

  // =====================================================================
  // Sprint 13 — Tier A: native Node specialist agents wrapping well-known
  // OSS libraries (Tesseract.js, Readability, qrcode, exifr, nomnoml,
  // PapaParse). All sync, all in-process, no AI keys required.
  // =====================================================================

  // ---------------------------------------------------------------------
  // ocr-vision — Tesseract.js OCR. Image → text.
  // ---------------------------------------------------------------------
  {
    slug: "ocr-vision",
    name: "ocr-vision",
    tagline: "Extract text from any image — 100+ languages, no AI keys.",
    description:
      "Pure-Node OCR backed by Tesseract.js. Pass an image URL or base64 and get back the recognised text plus per-word bounding boxes and confidence scores. SSRF-guarded fetch.",
    longDescription:
      "ocr-vision wraps Tesseract.js — the WebAssembly port of Google's Tesseract — and exposes it as a one-call API. No native dependencies, no Docker, no language servers; the worker downloads ~10 MB of language data on first use and caches it.\n\nUse it for: receipt parsing, signage transcription, scanned PDFs (one page at a time), handwritten note digitisation (when neat enough).\n\nLanguage codes follow Tesseract's three-letter convention: 'eng', 'spa', 'fra', 'deu', etc. Combine languages with '+' (e.g. 'eng+jpn') when documents are bilingual. Output includes the full text plus the first 1000 word-level bounding boxes for layout-aware downstream processing.\n\nSSRF guard: requests with imageUrl are rejected when the host resolves to a private / loopback / link-local address. Input is capped at 25 MB.",
    category: "Utilities",
    tags: ["ocr", "text-extraction", "tesseract", "vision", "utility", "non-ai"],
    iconEmoji: "🔡",
    accentHex: "#22c55e",
    screenshots: ["Recognised text", "Per-word boxes", "Confidence breakdown"],
    pricePerCall: 3,
    isAsync: false,
    inputSchema: {
      type: "object",
      oneOf: [{ required: ["imageUrl"] }, { required: ["imageBase64"] }],
      properties: {
        imageUrl: { type: "string", format: "uri", description: "https URL to the source image (max 25 MB)." },
        imageBase64: { type: "string", description: "Base64-encoded image bytes (raw or data: URL)." },
        language: {
          type: "string",
          default: "eng",
          description: "Tesseract language code; combine with '+' (e.g. 'eng+fra').",
          pattern: "^[a-z]{3}(\\+[a-z]{3})*$",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["text", "language", "confidence", "wordCount"],
      properties: {
        text: { type: "string" },
        language: { type: "string" },
        confidence: { type: "number", description: "Average word confidence, 0-100." },
        wordCount: { type: "integer" },
        words: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              confidence: { type: "number" },
              bbox: {
                type: "object",
                properties: {
                  x0: { type: "integer" },
                  y0: { type: "integer" },
                  x1: { type: "integer" },
                  y1: { type: "integer" },
                },
              },
            },
          },
        },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      imageUrl: "https://tesseract.projectnaptha.com/img/eng_bw.png",
      language: "eng",
    },
    exampleResponse: {
      text: "The quick brown fox jumps over the lazy dog.",
      language: "eng",
      confidence: 96.2,
      wordCount: 9,
      durationMs: 1820,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/ocr-vision/run",
  },

  // ---------------------------------------------------------------------
  // scrape-clean — URL → clean article markdown via @extractus + turndown.
  // ---------------------------------------------------------------------
  {
    slug: "scrape-clean",
    name: "scrape-clean",
    tagline: "Any article URL → clean Markdown. Strip nav, ads, footer.",
    description:
      "Give it a URL and scrape-clean returns the title, byline, publish date, and the article body as Markdown — no nav, no ads, no comment widgets. Backed by Mozilla Readability's extractor.",
    longDescription:
      "scrape-clean wraps @extractus/article-extractor (a maintained Readability port) and pipes the cleaned HTML through Turndown to produce a portable Markdown payload. Use it as the front-end of any RAG ingestion pipeline, link-summariser, or 'send to my reader' flow.\n\nReturns: title, byline, source / siteName, publication date, excerpt, Markdown body, plaintext body, and a word count. Optionally include the raw cleaned HTML for downstream rendering.\n\nSSRF-guarded fetch (same allowlist as img-shrink); private / loopback / link-local addresses are refused even if DNS round-robins to them.",
    category: "Utilities",
    tags: ["scraper", "readability", "markdown", "rag", "utility", "non-ai"],
    iconEmoji: "📰",
    accentHex: "#0ea5e9",
    screenshots: ["Source URL", "Extracted markdown", "Metadata panel"],
    pricePerCall: 2,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri", description: "Article URL to extract." },
        includeHtml: { type: "boolean", default: false, description: "Also return the cleaned HTML." },
      },
    },
    outputSchema: {
      type: "object",
      required: ["url", "title", "markdown", "plaintext", "wordCount"],
      properties: {
        url: { type: "string", format: "uri" },
        title: { type: "string" },
        byline: { type: ["string", "null"] },
        siteName: { type: ["string", "null"] },
        publishedAt: { type: ["string", "null"] },
        excerpt: { type: ["string", "null"] },
        markdown: { type: "string" },
        plaintext: { type: "string" },
        html: { type: "string" },
        wordCount: { type: "integer" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: { url: "https://en.wikipedia.org/wiki/Marketplace" },
    exampleResponse: {
      url: "https://en.wikipedia.org/wiki/Marketplace",
      title: "Marketplace",
      siteName: "Wikipedia",
      excerpt: "A marketplace is a location where people regularly gather…",
      markdown: "# Marketplace\n\nA marketplace is a location where people regularly gather…",
      plaintext: "A marketplace is a location where people regularly gather…",
      wordCount: 1640,
      durationMs: 740,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/scrape-clean/run",
  },

  // ---------------------------------------------------------------------
  // qr-toolkit — encode + decode + classify QR codes.
  // ---------------------------------------------------------------------
  {
    slug: "qr-toolkit",
    name: "qr-toolkit",
    tagline: "Encode, decode, and classify QR codes. SVG + PNG out.",
    description:
      "One API for the full QR lifecycle. Generate a QR from any payload (URL, WiFi, vCard, mailto, plain text), or decode one back to its text + a parsed payload object.",
    longDescription:
      "qr-toolkit unifies QR generation and QR reading under a single endpoint. Set `mode: 'encode'` to generate — you get back the QR as both SVG (inline) and a PNG you can host or embed. Set `mode: 'decode'` to read — pass a base64 image and get back the encoded text plus a classification of what kind of payload it is (URL, WiFi credential, vCard, mailto, sms, geo, tel, or plain text).\n\nFor common payload kinds the response includes a structured `parsed` object — e.g. WiFi payloads return SSID + password + auth type; mailto payloads return to + subject + body; vCard payloads return the parsed field map.\n\nGenerator: `qrcode` (npm). Decoder: `jsqr` over a sharp-rasterised RGBA grid — works on JPEG / PNG / WebP / AVIF inputs.",
    category: "Utilities",
    tags: ["qr", "encoder", "decoder", "wifi", "vcard", "utility", "non-ai"],
    iconEmoji: "▦",
    accentHex: "#f59e0b",
    screenshots: ["Encode payload", "PNG output", "Decode + classify"],
    pricePerCall: 1,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["mode"],
      oneOf: [
        {
          properties: {
            mode: { const: "encode" },
            text: { type: "string", maxLength: 2953, description: "Payload to encode." },
            errorCorrection: { type: "string", enum: ["L", "M", "Q", "H"], default: "M" },
            margin: { type: "integer", minimum: 0, maximum: 16, default: 2 },
            scale: { type: "integer", minimum: 1, maximum: 32, default: 6 },
            darkColor: { type: "string", default: "#000000ff" },
            lightColor: { type: "string", default: "#ffffffff" },
          },
          required: ["mode", "text"],
        },
        {
          properties: {
            mode: { const: "decode" },
            imageBase64: { type: "string", description: "Base64-encoded image bytes." },
          },
          required: ["mode", "imageBase64"],
        },
      ],
    },
    outputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["encode", "decode"] },
        svg: { type: "string", description: "Encode mode only — inline SVG of the QR." },
        previewUrl: { type: "string", format: "uri" },
        downloadUrl: { type: "string", format: "uri" },
        text: { type: "string", description: "Decode mode only — extracted payload." },
        payloadKind: { type: "string", enum: ["url", "wifi", "vcard", "mailto", "sms", "geo", "tel", "text"] },
        parsed: { type: ["object", "null"] },
        length: { type: "integer" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      mode: "encode",
      text: "WIFI:T:WPA;S:Cafe;P:hunter2;;",
      errorCorrection: "Q",
      scale: 8,
    },
    exampleResponse: {
      mode: "encode",
      previewUrl: "http://localhost:4000/r/a7b3.png",
      downloadUrl: "http://localhost:4000/r/a7b3.png",
      payloadKind: "wifi",
      length: 28,
      durationMs: 22,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/qr-toolkit/run",
  },

  // ---------------------------------------------------------------------
  // exif-clean — strip EXIF/GPS/XMP/ICC from images.
  // ---------------------------------------------------------------------
  {
    slug: "exif-clean",
    name: "exif-clean",
    tagline: "Strip EXIF, GPS, and other metadata from photos. Privacy in one call.",
    description:
      "Upload an image; get back a re-encoded copy with every metadata segment removed (EXIF, GPS, XMP, ICC). Returns a summary of what was stripped so you can show users the win.",
    longDescription:
      "exif-clean re-encodes images through sharp without preserving metadata — the cleanest cross-format guarantee that EXIF, GPS, XMP, and ICC segments are dropped. Before re-encoding it parses what was in the file via exifr and returns a `removed` summary including the camera make/model, capture timestamp, and GPS coordinates if any.\n\nUse it for: stripping geotags from photos before posting, anonymising user-uploaded images, scrubbing camera serial numbers before publishing samples.\n\nOutput format: by default the source format is preserved (jpeg/png/webp). Pass `outputFormat` to force a target. Output is hosted under /r/ for download.",
    category: "Image",
    tags: ["exif", "privacy", "gps", "metadata", "utility", "non-ai"],
    iconEmoji: "🧽",
    accentHex: "#06b6d4",
    screenshots: ["Before metadata", "After cleaned", "Removed summary"],
    pricePerCall: 1,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["imageBase64"],
      properties: {
        imageBase64: { type: "string", description: "Base64-encoded image bytes (raw or data: URL)." },
        outputFormat: {
          type: "string",
          enum: ["preserve", "jpeg", "png", "webp"],
          default: "preserve",
          description: "Target format. 'preserve' keeps the source format.",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["previewUrl", "outputFormat", "removed"],
      properties: {
        previewUrl: { type: "string", format: "uri" },
        downloadUrl: { type: "string", format: "uri" },
        outputFormat: { type: "string" },
        width: { type: "integer" },
        height: { type: "integer" },
        originalBytes: { type: "integer" },
        outputBytes: { type: "integer" },
        savedBytes: { type: "integer" },
        removed: {
          type: "object",
          properties: {
            hasExif: { type: "boolean" },
            hasGps: { type: "boolean" },
            hasXmp: { type: "boolean" },
            hasIcc: { type: "boolean" },
            camera: { type: ["string", "null"] },
            takenAt: { type: ["string", "null"] },
            gps: { type: ["object", "null"] },
          },
        },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: { imageBase64: "<base64 jpeg with geotag>", outputFormat: "preserve" },
    exampleResponse: {
      previewUrl: "http://localhost:4000/r/c1b9.jpg",
      downloadUrl: "http://localhost:4000/r/c1b9.jpg",
      outputFormat: "jpeg",
      width: 4032,
      height: 3024,
      originalBytes: 3_241_044,
      outputBytes: 2_891_512,
      savedBytes: 349_532,
      removed: {
        hasExif: true,
        hasGps: true,
        hasXmp: false,
        hasIcc: true,
        camera: "Apple iPhone 15 Pro",
        takenAt: "2026-04-18T14:22:00.000Z",
        gps: { lat: 12.9716, lon: 77.5946 },
      },
      durationMs: 412,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/exif-clean/run",
  },

  // ---------------------------------------------------------------------
  // diagram-forge — text DSL → SVG diagram via nomnoml.
  // ---------------------------------------------------------------------
  {
    slug: "diagram-forge",
    name: "diagram-forge",
    tagline: "Text DSL → rendered SVG diagrams. No headless browser needed.",
    description:
      "Write a tiny text DSL (UML / flowchart / boxes-and-arrows); get back a clean SVG plus a hosted file link. Pure JS, no headless Chromium, no Java.",
    longDescription:
      "diagram-forge wraps nomnoml — the well-loved pure-JS diagram renderer. Source format is a one-line-per-edge DSL: `[Buyer] -> [orqis API]`. Compound nodes, classifiers, associations, notes and decorators all supported.\n\nFour built-in styles (default, ink, vintage, minimal) set fonts, fills, and stroke weights to match the look of your docs. Pass `direction: 'right'` for left-to-right layouts, omit it for top-down.\n\nUse it for: README architecture diagrams, ad-hoc whiteboard captures, agent-generated docs (Claude can emit nomnoml from a high-level description in one shot).",
    category: "Utilities",
    tags: ["diagram", "svg", "nomnoml", "uml", "docs", "utility", "non-ai"],
    iconEmoji: "📐",
    accentHex: "#8b5cf6",
    screenshots: ["DSL input", "Rendered SVG", "Style picker"],
    pricePerCall: 2,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["source"],
      properties: {
        source: { type: "string", maxLength: 20000, description: "nomnoml DSL source." },
        direction: { type: "string", enum: ["down", "right"], default: "down" },
        style: {
          type: "string",
          enum: ["default", "ink", "vintage", "minimal"],
          default: "default",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["previewUrl", "svg", "styleApplied"],
      properties: {
        previewUrl: { type: "string", format: "uri" },
        downloadUrl: { type: "string", format: "uri" },
        svg: { type: "string" },
        width: { type: "integer" },
        height: { type: "integer" },
        styleApplied: { type: "string" },
        sourceLength: { type: "integer" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      source: "[Buyer] -> [orqis API]\n[orqis API] -> [Seller Agent]\n[Seller Agent] -> [orqis API]\n[orqis API] -> [Buyer]",
      direction: "right",
      style: "ink",
    },
    exampleResponse: {
      previewUrl: "http://localhost:4000/r/d2a4.svg",
      downloadUrl: "http://localhost:4000/r/d2a4.svg",
      svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"480\" height=\"180\">…</svg>",
      width: 480,
      height: 180,
      styleApplied: "ink",
      sourceLength: 102,
      durationMs: 18,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/diagram-forge/run",
  },

  // ---------------------------------------------------------------------
  // csv-mage — CSV → JSON / NDJSON / SQL with schema inference.
  // ---------------------------------------------------------------------
  {
    slug: "csv-mage",
    name: "csv-mage",
    tagline: "CSV → JSON / NDJSON / SQL. Schema inferred, duplicates optional.",
    description:
      "Paste a CSV, pick a target format, and csv-mage returns the converted output plus an inferred column schema (integer / number / boolean / date / string + nullability).",
    longDescription:
      "csv-mage is the small, sharp CSV utility every backend secretly needs. It parses with PapaParse, infers each column's type from sampled rows, and renders the result as JSON (pretty-printed array), NDJSON (one row per line), or SQL (CREATE TABLE + INSERTs with quoted identifiers and properly typed literals).\n\nOptional `dedupe: true` drops exact-duplicate rows. `tableName` controls the SQL output's identifier; it must be a valid SQL identifier. `delimiter` defaults to PapaParse's auto-detect — override it for tab-separated or pipe-separated input.\n\nLimits: 8 MB of input, 100k rows per call.",
    category: "Utilities",
    tags: ["csv", "json", "sql", "etl", "schema-inference", "utility", "non-ai"],
    iconEmoji: "🗃️",
    accentHex: "#10b981",
    screenshots: ["Input CSV", "Inferred schema", "SQL output"],
    pricePerCall: 1,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["csv"],
      properties: {
        csv: { type: "string", description: "The CSV text (up to 8 MB / 100k rows)." },
        format: { type: "string", enum: ["json", "ndjson", "sql"], default: "json" },
        tableName: {
          type: "string",
          pattern: "^[a-zA-Z_][a-zA-Z0-9_]*$",
          description: "SQL output only. Defaults to 'imported'.",
        },
        delimiter: { type: "string", description: "Override delimiter (defaults to auto-detect)." },
        hasHeader: { type: "boolean", default: true },
        dedupe: { type: "boolean", default: false },
        sampleRows: {
          type: "integer",
          minimum: 10,
          maximum: 2000,
          default: 200,
          description: "How many rows to sample for type inference.",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["format", "output", "rowsParsed", "rowsOutput", "columns"],
      properties: {
        format: { type: "string", enum: ["json", "ndjson", "sql"] },
        output: { type: "string" },
        rowsParsed: { type: "integer" },
        rowsOutput: { type: "integer" },
        rowsDropped: { type: "integer" },
        columns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string", enum: ["integer", "number", "boolean", "date", "string"] },
              nullable: { type: "boolean" },
            },
          },
        },
        errors: { type: "array", items: { type: "string" } },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      csv: "id,name,price,in_stock\n1,Widget,9.99,true\n2,Gadget,14.50,false",
      format: "sql",
      tableName: "products",
    },
    exampleResponse: {
      format: "sql",
      output: 'CREATE TABLE "products" (\n  "id" INTEGER NOT NULL,\n  "name" TEXT NOT NULL,\n  "price" DOUBLE PRECISION NOT NULL,\n  "in_stock" BOOLEAN NOT NULL\n);\n\nINSERT INTO "products" ("id", "name", "price", "in_stock") VALUES (1, \'Widget\', 9.99, TRUE);\nINSERT INTO "products" ("id", "name", "price", "in_stock") VALUES (2, \'Gadget\', 14.50, FALSE);\n',
      rowsParsed: 2,
      rowsOutput: 2,
      rowsDropped: 0,
      columns: [
        { name: "id", type: "integer", nullable: false },
        { name: "name", type: "string", nullable: false },
        { name: "price", type: "number", nullable: false },
        { name: "in_stock", type: "boolean", nullable: false },
      ],
      errors: [],
      durationMs: 6,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/csv-mage/run",
  },

  // =====================================================================
  // Sprint 14 — Tier B: specialist agents wrapping external binaries
  // (tectonic, pandoc) and Python sidecar services (rembg, faster-whisper).
  // All ship with mock mode so the catalogue runs end-to-end without the
  // external deps. Real-mode env: TEX_PIPELINE, PANDOC_PIPELINE,
  // BG_STRIP_PIPELINE + BG_STRIP_SIDECAR_URL, WHISPER_PIPELINE +
  // WHISPER_SIDECAR_URL.
  // =====================================================================

  // ---------------------------------------------------------------------
  // tex-press — LaTeX source bundle → PDF via tectonic.
  // ---------------------------------------------------------------------
  {
    slug: "tex-press",
    name: "tex-press",
    tagline: "LaTeX source bundle → PDF. Single binary, no TeX Live install.",
    description:
      "Send one or more .tex / .sty / .bib / image files; get back a compiled PDF. Backed by tectonic — a single-binary LaTeX engine that auto-downloads any packages your document needs.",
    longDescription:
      "tex-press wraps the tectonic LaTeX engine. Unlike full TeX Live (~5 GB), tectonic is a single ~50 MB binary that lazily downloads only the packages each document actually uses, then caches them. Perfect for serverless / container deployments where you don't want a half-GB image just to compile a 12-page paper.\n\nInput is a `files[]` array — each file is `{ name, contentBase64 }`. Files can include subdirectories (`figures/diagram.png`, `chapters/intro.tex`). The `entrypoint` field names the top-level `.tex` (default: `main.tex`).\n\nUse it for: academic papers, slide decks (Beamer), invoices and contracts, anything where you need pixel-perfect typography and equations. Pairs well with course-quill (which can output a .tex bundle that you then compile here for different output formats).\n\nLimits: 32 files, 16 MB total input, 60-second compile timeout. Real mode requires `tectonic` on PATH plus `TEX_PIPELINE=real`.",
    category: "Document",
    tags: ["latex", "pdf", "tectonic", "academic", "typesetting", "utility"],
    iconEmoji: "📄",
    accentHex: "#dc2626",
    screenshots: ["Source files", "Compiled PDF", "Engine logs"],
    pricePerCall: 5,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["files"],
      properties: {
        files: {
          type: "array",
          minItems: 1,
          maxItems: 32,
          items: {
            type: "object",
            required: ["name", "contentBase64"],
            properties: {
              name: { type: "string", description: "Relative path inside the source tree." },
              contentBase64: { type: "string" },
            },
          },
        },
        entrypoint: {
          type: "string",
          default: "main.tex",
          description: "Top-level .tex file to compile.",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["previewUrl", "engineUsed"],
      properties: {
        previewUrl: { type: "string", format: "uri" },
        downloadUrl: { type: "string", format: "uri" },
        pdfBytes: { type: "integer" },
        pageCount: { type: ["integer", "null"] },
        filesUsed: { type: "array", items: { type: "string" } },
        entrypoint: { type: "string" },
        engineUsed: { type: "string", enum: ["tectonic", "mock"] },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      files: [
        {
          name: "main.tex",
          contentBase64: "XGRvY3VtZW50Y2xhc3N7YXJ0aWNsZX0gXGJlZ2lue2RvY3VtZW50fSBIZWxsbyBvcnFpcy4gXGVuZHtkb2N1bWVudH0=",
        },
      ],
      entrypoint: "main.tex",
    },
    exampleResponse: {
      previewUrl: "http://localhost:4000/r/d8c3.pdf",
      downloadUrl: "http://localhost:4000/r/d8c3.pdf",
      pdfBytes: 14_512,
      pageCount: 1,
      filesUsed: ["main.tex"],
      entrypoint: "main.tex",
      engineUsed: "tectonic",
      durationMs: 1_840,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/tex-press/run",
  },

  // ---------------------------------------------------------------------
  // doc-converter — any-format → any-format via pandoc.
  // ---------------------------------------------------------------------
  {
    slug: "doc-converter",
    name: "doc-converter",
    tagline: "Markdown ↔ HTML ↔ DOCX ↔ EPUB ↔ LaTeX. The pandoc API you wanted.",
    description:
      "One call to convert between Markdown, HTML, DOCX, EPUB, LaTeX, reStructuredText, Org, and plaintext. Backed by pandoc — the universal document converter.",
    longDescription:
      "doc-converter exposes pandoc as a simple JSON API. Pick `from` and `to` from the supported format list, hand over your `content` (utf-8 string, or base64 when the source is binary like DOCX/EPUB), and get back the converted output.\n\nText outputs (md, html, latex, rst, org, plaintext) are returned as utf-8 strings. Binary outputs (docx, epub) are returned base64-encoded with `outputIsBase64: true`.\n\nUse it for: turning user-submitted Markdown into DOCX for download, normalising mixed-format docs in a RAG ingest pipeline, generating HTML previews of LaTeX submissions, converting Org-mode notes to EPUB.\n\nLimits: 5 MB input, 30-second timeout. Real mode requires `pandoc` on PATH plus `PANDOC_PIPELINE=real`. PDF *output* needs a TeX engine — use tex-press for that pipeline.",
    category: "Document",
    tags: ["pandoc", "markdown", "docx", "epub", "latex", "converter", "utility"],
    iconEmoji: "🔄",
    accentHex: "#7c3aed",
    screenshots: ["Format picker", "Conversion preview", "Engine details"],
    pricePerCall: 3,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["from", "to", "content"],
      properties: {
        from: {
          type: "string",
          enum: ["md", "html", "docx", "epub", "latex", "rst", "org", "plaintext"],
        },
        to: {
          type: "string",
          enum: ["md", "html", "docx", "epub", "latex", "rst", "org", "plaintext"],
        },
        content: { type: "string", description: "Source content (utf-8 or base64)." },
        base64: {
          type: "boolean",
          default: false,
          description: "Required when from = docx or epub.",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["output", "outputIsBase64", "outputFormat", "inputFormat"],
      properties: {
        output: { type: "string" },
        outputIsBase64: { type: "boolean" },
        outputBytes: { type: "integer" },
        outputFormat: { type: "string" },
        inputFormat: { type: "string" },
        engineUsed: { type: "string", enum: ["pandoc", "mock"] },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      from: "md",
      to: "html",
      content: "# Hello orqis\n\nThis is **bold**.",
    },
    exampleResponse: {
      output: "<h1 id=\"hello-orqis\">Hello orqis</h1>\n<p>This is <strong>bold</strong>.</p>",
      outputIsBase64: false,
      outputBytes: 79,
      outputFormat: "html",
      inputFormat: "md",
      engineUsed: "pandoc",
      durationMs: 92,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/doc-converter/run",
  },

  // ---------------------------------------------------------------------
  // bg-strip — background removal via rembg sidecar.
  // ---------------------------------------------------------------------
  {
    slug: "bg-strip",
    name: "bg-strip",
    tagline: "Background removal for product shots, headshots, anything.",
    description:
      "Send an image; get back a PNG with the background replaced by transparency (or a flat colour). Real mode runs rembg / U²-Net in a Python sidecar; mock mode applies a corner-derived chroma matte so the pipeline works without the sidecar.",
    longDescription:
      "bg-strip is orqis's background-removal endpoint. The implementation is a Node service that proxies to a Python sidecar running rembg (the same U²-Net the open-source community has standardised on for foreground extraction). The sidecar isolation is deliberate — it's the same shape we'll use for seller-supplied Docker services in Month 4.\n\nFour model presets are supported by the sidecar: `u2net` (default, general-purpose), `u2netp` (smaller / faster), `isnet-general-use` (sharp edges), `silueta` (better for people).\n\nOutput is always PNG with an alpha channel. Pass `fillHex` (e.g. `#ffffff`) to replace the removed pixels with a flat colour instead of transparency — useful when downstream tools don't preserve alpha.\n\nMock mode runs entirely in Node: it samples the four corner pixels, treats their average as the background colour, and turns near-matches transparent. Works surprisingly well on clean studio shots; predictably bad on complex backgrounds. Switch to real mode (`BG_STRIP_PIPELINE=real` + `BG_STRIP_SIDECAR_URL`) for production use.",
    category: "Image",
    tags: ["background-removal", "rembg", "u2net", "image", "product-shot"],
    iconEmoji: "✂️",
    accentHex: "#ec4899",
    screenshots: ["Source photo", "Mask preview", "Transparent output"],
    pricePerCall: 5,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["imageBase64"],
      properties: {
        imageBase64: {
          type: "string",
          description: "Base64-encoded source image (raw or data: URL).",
        },
        model: {
          type: "string",
          enum: ["u2net", "u2netp", "isnet-general-use", "silueta"],
          default: "u2net",
        },
        fillHex: {
          type: "string",
          pattern: "^#[0-9a-fA-F]{6}$",
          description: "Optional. Replace removed pixels with this flat colour instead of transparency.",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["previewUrl", "engineUsed", "modelUsed"],
      properties: {
        previewUrl: { type: "string", format: "uri" },
        downloadUrl: { type: "string", format: "uri" },
        width: { type: "integer" },
        height: { type: "integer" },
        originalBytes: { type: "integer" },
        outputBytes: { type: "integer" },
        modelUsed: { type: "string" },
        engineUsed: { type: "string", enum: ["sidecar", "mock"] },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      imageBase64: "<base64 product photo>",
      model: "u2net",
    },
    exampleResponse: {
      previewUrl: "http://localhost:4000/r/f2e1.png",
      downloadUrl: "http://localhost:4000/r/f2e1.png",
      width: 1024,
      height: 1024,
      originalBytes: 412_881,
      outputBytes: 318_402,
      modelUsed: "u2net",
      engineUsed: "sidecar",
      durationMs: 2_140,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/bg-strip/run",
  },

  // ---------------------------------------------------------------------
  // subtitle-bot — async. faster-whisper sidecar.
  // ---------------------------------------------------------------------
  {
    slug: "subtitle-bot",
    name: "subtitle-bot",
    tagline: "Audio / video → SRT + VTT subtitles. 100+ languages. Optional translate-to-English.",
    description:
      "Async transcription with faster-whisper. Hand it an audio URL (or base64); get a webhook with SRT + VTT + per-segment timings + a plaintext transcript. Optional `translateToEnglish` runs Whisper's task-translate mode in one shot.",
    longDescription:
      "subtitle-bot is orqis's transcription agent. It accepts audio (MP3, WAV, M4A, FLAC) or video (MP4 — audio track extracted by the sidecar) and returns time-coded subtitle files in both SRT and WebVTT, a clean plaintext transcript, and the raw per-segment timings.\n\nFive model presets: `tiny` (fastest, ~75 MB), `base`, `small` (the default — best speed/quality tradeoff), `medium`, `large` (highest accuracy, slowest). All run on CPU in the sidecar; GPU support is on the roadmap.\n\nLanguage: omit `language` for auto-detect from the first ~30 s of audio. Pass an ISO 639-1 code (`en`, `es`, `ja`, `fr`, …) to skip detection. `translateToEnglish: true` produces English subtitles regardless of source language.\n\nAsync — the route layer 202-acks and a webhook delivers the result. Real mode requires `WHISPER_PIPELINE=real` + `WHISPER_SIDECAR_URL`. Mock mode delivers a canned 3-cue SRT after ~5 seconds for end-to-end pipeline testing.",
    category: "Audio",
    tags: ["whisper", "transcription", "subtitles", "srt", "vtt", "speech-to-text"],
    iconEmoji: "🎙️",
    accentHex: "#0891b2",
    screenshots: ["Audio waveform", "Cue list", "SRT preview"],
    pricePerCall: 20,
    isAsync: true,
    inputSchema: {
      type: "object",
      oneOf: [{ required: ["audioUrl"] }, { required: ["audioBase64"] }],
      properties: {
        audioUrl: { type: "string", format: "uri", description: "https URL to source audio/video." },
        audioBase64: { type: "string", description: "Base64-encoded audio bytes." },
        language: {
          type: "string",
          description: "ISO 639-1 code (en, es, fr, …). Omit for auto-detect.",
          pattern: "^[a-z]{2}$",
        },
        model: {
          type: "string",
          enum: ["tiny", "base", "small", "medium", "large"],
          default: "small",
        },
        translateToEnglish: { type: "boolean", default: false },
      },
    },
    outputSchema: {
      type: "object",
      required: ["srt", "vtt", "plaintext", "language", "segments"],
      properties: {
        srt: { type: "string" },
        vtt: { type: "string" },
        plaintext: { type: "string" },
        language: { type: "string" },
        durationSeconds: { type: "number" },
        segments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              start: { type: "number" },
              end: { type: "number" },
              text: { type: "string" },
            },
          },
        },
        modelUsed: { type: "string" },
        engineUsed: { type: "string", enum: ["sidecar", "mock"] },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      audioUrl: "https://example.com/clip.mp3",
      model: "small",
      language: "en",
    },
    exampleResponse: {
      srt: "1\n00:00:00,000 --> 00:00:03,400\nWelcome to the orqis demo.\n",
      vtt: "WEBVTT\n\n00:00:00.000 --> 00:00:03.400\nWelcome to the orqis demo.\n",
      plaintext: "Welcome to the orqis demo.",
      language: "en",
      durationSeconds: 3.4,
      segments: [{ start: 0, end: 3.4, text: "Welcome to the orqis demo." }],
      modelUsed: "small",
      engineUsed: "sidecar",
      durationMs: 11_240,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/subtitle-bot/run",
  },

  // =====================================================================
  // Sprint 15 — Tier C-A: browser-dep agents. All wrap Playwright (Chromium)
  // or Lighthouse + headless Chrome. CPU-only, no AI keys. Companion category
  // to scrape-clean (which does static-fetch + Readability extraction).
  // =====================================================================

  // ---------------------------------------------------------------------
  // page-shot — Playwright screenshot.
  // ---------------------------------------------------------------------
  {
    slug: "page-shot",
    name: "page-shot",
    tagline: "Pixel-perfect URL screenshots via headless Chromium.",
    description:
      "Pass a URL; get back a PNG or JPEG of the rendered page at any viewport. Supports full-page capture, dark/light mode, device emulation (desktop / tablet / mobile), and a simple ad-blocker.",
    longDescription:
      "page-shot wraps Playwright's screenshot pipeline. Backed by the same headless Chromium that powers Urlbox, ScreenshotAPI.net, and ScreenshotOne — except yours, in your stack, at marketplace pricing.\n\nUse it for: open-graph preview generation, marketing screenshots, visual-regression CI, blog illustrations of third-party pages, dashboards that snapshot reports on a schedule.\n\nViewport: any width / height between 320 and 2560 pixels. Device shortcuts (`desktop`, `tablet`, `mobile`) preset matching viewports and isMobile flags. Full-page mode captures the entire scroll height regardless of viewport.\n\n`hideAds: true` aborts requests to the highest-traffic ad / tracking domains (Google Ads, DoubleClick, Facebook Pixel, etc.) so the screenshot doesn't capture banner noise. Not a full uBlock list — call out specific hosts via your own proxy if you need that.\n\nSSRF-guarded URL fetch. 30-second nav timeout. Output is hosted under /r/ for download.",
    category: "Web",
    tags: ["screenshot", "playwright", "chromium", "preview", "og-image", "utility"],
    iconEmoji: "📸",
    accentHex: "#3b82f6",
    screenshots: ["Desktop full-page", "Mobile viewport", "Dark mode + hideAds"],
    pricePerCall: 2,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri" },
        width: { type: "integer", minimum: 320, maximum: 2560 },
        height: { type: "integer", minimum: 320, maximum: 2160 },
        fullPage: { type: "boolean", default: false },
        device: { type: "string", enum: ["desktop", "tablet", "mobile"], default: "desktop" },
        format: { type: "string", enum: ["png", "jpeg"], default: "png" },
        quality: { type: "integer", minimum: 1, maximum: 100, default: 85, description: "JPEG only." },
        waitUntil: { type: "string", enum: ["load", "domcontentloaded", "networkidle"], default: "networkidle" },
        darkMode: { type: "boolean", default: false },
        hideAds: { type: "boolean", default: false },
        delayMs: { type: "integer", minimum: 0, maximum: 5000, default: 0 },
      },
    },
    outputSchema: {
      type: "object",
      required: ["previewUrl", "width", "height", "format"],
      properties: {
        previewUrl: { type: "string", format: "uri" },
        downloadUrl: { type: "string", format: "uri" },
        width: { type: "integer" },
        height: { type: "integer" },
        fullPage: { type: "boolean" },
        device: { type: "string" },
        format: { type: "string" },
        finalUrl: { type: "string", format: "uri" },
        outputBytes: { type: "integer" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: { url: "https://orqis.xyz", fullPage: true, hideAds: true },
    exampleResponse: {
      previewUrl: "http://localhost:4000/r/c4a1.png",
      downloadUrl: "http://localhost:4000/r/c4a1.png",
      width: 1440,
      height: 900,
      fullPage: true,
      device: "desktop",
      format: "png",
      finalUrl: "https://orqis.xyz/",
      outputBytes: 412_881,
      durationMs: 2_140,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/page-shot/run",
  },

  // ---------------------------------------------------------------------
  // pdf-render — Playwright HTML/URL → PDF.
  // ---------------------------------------------------------------------
  {
    slug: "pdf-render",
    name: "pdf-render",
    tagline: "HTML or URL → pixel-perfect PDF via real Chromium.",
    description:
      "Hand it a URL or raw HTML; get back a PDF rendered by the same engine Chrome uses for File → Print → Save as PDF. CSS, web fonts, images, page breaks — all respected.",
    longDescription:
      "pdf-render is the companion to doc-converter: doc-converter goes through pandoc (great for prose-style conversions, mediocre for visual fidelity), while pdf-render uses Playwright's page.pdf() — the same engine behind DocRaptor, PDFShift, PDFmonkey.\n\nInput modes:\n• `url` — fetch a live URL (SSRF-guarded), wait for it to be interactive, render.\n• `html` — sandbox-render raw markup. Up to 8 MB of HTML.\n\nFormat: any Chromium-supported paper size (Letter, Legal, Tabloid, A0–A6). `landscape: true` flips orientation. `marginInches` lets you override the per-side 0.5″ default (each side accepts 0–4 inches independently).\n\nHeader / footer: pass HTML snippets via `headerHtml` and `footerHtml` — Chromium injects them on every page. Use `<span class=\"pageNumber\"></span>` / `<span class=\"totalPages\"></span>` / `<span class=\"date\"></span>` for dynamic values.\n\n30-second nav timeout. Page count is heuristically estimated from the PDF's object stream.",
    category: "Document",
    tags: ["pdf", "html-to-pdf", "playwright", "chromium", "report", "invoice", "utility"],
    iconEmoji: "🖨️",
    accentHex: "#ef4444",
    screenshots: ["URL → PDF", "HTML → PDF", "Custom margins + landscape"],
    pricePerCall: 3,
    isAsync: false,
    inputSchema: {
      type: "object",
      oneOf: [{ required: ["url"] }, { required: ["html"] }],
      properties: {
        url: { type: "string", format: "uri" },
        html: { type: "string" },
        format: {
          type: "string",
          enum: ["Letter", "Legal", "Tabloid", "Ledger", "A0", "A1", "A2", "A3", "A4", "A5", "A6"],
          default: "A4",
        },
        landscape: { type: "boolean", default: false },
        printBackground: { type: "boolean", default: true },
        marginInches: {
          type: "object",
          properties: {
            top: { type: "number", minimum: 0, maximum: 4 },
            right: { type: "number", minimum: 0, maximum: 4 },
            bottom: { type: "number", minimum: 0, maximum: 4 },
            left: { type: "number", minimum: 0, maximum: 4 },
          },
        },
        scale: { type: "number", minimum: 0.1, maximum: 2, default: 1 },
        waitUntil: { type: "string", enum: ["load", "domcontentloaded", "networkidle"], default: "networkidle" },
        delayMs: { type: "integer", minimum: 0, maximum: 5000, default: 0 },
        headerHtml: { type: "string" },
        footerHtml: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["previewUrl", "outputBytes", "formatUsed"],
      properties: {
        previewUrl: { type: "string", format: "uri" },
        downloadUrl: { type: "string", format: "uri" },
        pageCount: { type: ["integer", "null"] },
        outputBytes: { type: "integer" },
        formatUsed: { type: "string" },
        landscape: { type: "boolean" },
        finalUrl: { type: ["string", "null"], format: "uri" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: { url: "https://orqis.xyz/changelog", format: "A4", marginInches: { top: 0.75 } },
    exampleResponse: {
      previewUrl: "http://localhost:4000/r/e9f2.pdf",
      downloadUrl: "http://localhost:4000/r/e9f2.pdf",
      pageCount: 3,
      outputBytes: 184_212,
      formatUsed: "A4",
      landscape: false,
      finalUrl: "https://orqis.xyz/changelog",
      durationMs: 1_680,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/pdf-render/run",
  },

  // ---------------------------------------------------------------------
  // scrape-render — JS-rendering scrape (Playwright).
  // ---------------------------------------------------------------------
  {
    slug: "scrape-render",
    name: "scrape-render",
    tagline: "Scrape any URL — including SPAs and JS-rendered content.",
    description:
      "The dynamic-content companion to scrape-clean. scrape-clean does a static fetch + Readability extraction; scrape-render runs the page in real Chromium so SPAs, hydrated content, and client-side rendering all work.",
    longDescription:
      "scrape-render exists for the pages scrape-clean can't handle. If you `view-source` and see an empty `<div id=\"root\"></div>`, the content is rendered by JavaScript after page load — you need a real browser to see it.\n\nReturns: the post-render HTML, page title, HTTP status, meta description, canonical URL, OG / Twitter card metadata, favicon, and the first 500 outbound links.\n\nShortcuts to skip parsing the full DOM downstream:\n• `extractText: true` — returns the visible body text via `innerText()` (≤200k chars).\n• `selectorMap: { price: \"#price\", rating: \".stars\" }` — runs `document.querySelector(...)` per key and returns each match's text. Up to 20 selectors per call.\n\nDevice emulation: `desktop` (1440×900) or `mobile` (390×844 + isMobile UA). 30-second nav timeout. SSRF-guarded URL fetch.\n\nCompetes with: ScrapingBee, ZenRows, Bright Data's Web Unlocker — but at marketplace pricing and without the proxy markup.",
    category: "Web",
    tags: ["scraper", "javascript", "spa", "playwright", "rag", "utility"],
    iconEmoji: "🕷️",
    accentHex: "#a855f7",
    screenshots: ["Rendered HTML", "Metadata panel", "Selector extraction"],
    pricePerCall: 3,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri" },
        waitUntil: { type: "string", enum: ["load", "domcontentloaded", "networkidle"], default: "networkidle" },
        delayMs: { type: "integer", minimum: 0, maximum: 5000, default: 0 },
        device: { type: "string", enum: ["desktop", "mobile"], default: "desktop" },
        extractText: { type: "boolean", default: false },
        selectorMap: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Key → CSS selector. Returns each match's innerText.",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["finalUrl", "title", "status", "html", "metadata", "linkCount"],
      properties: {
        finalUrl: { type: "string", format: "uri" },
        title: { type: "string" },
        status: { type: "integer" },
        html: { type: "string" },
        text: { type: ["string", "null"] },
        metadata: {
          type: "object",
          properties: {
            description: { type: ["string", "null"] },
            canonical: { type: ["string", "null"] },
            ogTitle: { type: ["string", "null"] },
            ogImage: { type: ["string", "null"] },
            twitterCard: { type: ["string", "null"] },
            twitterImage: { type: ["string", "null"] },
            favicon: { type: ["string", "null"] },
          },
        },
        selectors: { type: "object", additionalProperties: { type: ["string", "null"] } },
        linkCount: { type: "integer" },
        links: { type: "array", items: { type: "string", format: "uri" } },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      url: "https://orqis.xyz/browse",
      extractText: true,
      selectorMap: { firstAgent: "article h2" },
    },
    exampleResponse: {
      finalUrl: "https://orqis.xyz/browse",
      title: "Browse — orqis",
      status: 200,
      html: "<!doctype html><html><body><article><h2>landing-forge</h2>…</article>…</body></html>",
      metadata: { description: "Browse specialist AI agents…", canonical: "https://orqis.xyz/browse", ogTitle: "Browse — orqis", ogImage: "https://orqis.xyz/og.png", twitterCard: "summary_large_image", twitterImage: null, favicon: "/favicon.ico" },
      selectors: { firstAgent: "landing-forge" },
      linkCount: 47,
      durationMs: 1_920,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/scrape-render/run",
  },

  // ---------------------------------------------------------------------
  // lighthouse-audit — Google Lighthouse run.
  // ---------------------------------------------------------------------
  {
    slug: "lighthouse-audit",
    name: "lighthouse-audit",
    tagline: "Full Google Lighthouse run on any URL. Scores + Core Web Vitals.",
    description:
      "Audits any URL against all four Lighthouse categories: performance, accessibility, best-practices, SEO. Returns Core Web Vitals, top optimization opportunities, and failed a11y checks.",
    longDescription:
      "lighthouse-audit wraps the official `lighthouse` npm package — the same engine that powers PageSpeed Insights, Chrome DevTools' Lighthouse tab, and Web.dev measurement. Lighthouse spawns its own headless Chrome via chrome-launcher.\n\nReturns:\n• `scores` — 0-100 per category (performance, accessibility, best-practices, seo).\n• `metrics` — Core Web Vitals: First Contentful Paint, Largest Contentful Paint, Total Blocking Time, Cumulative Layout Shift, Speed Index, Time to Interactive. All values in ms (CLS is unitless 0-1).\n• `network` — total bytes downloaded, total request count.\n• `opportunities` — top 10 perf optimization opportunities sorted by estimated savings (image compression, unused JS, render-blocking resources, etc.).\n• `failedAccessibility` — failed a11y audits filtered to the high-signal categories (ARIA, contrast, alt text, labels).\n\nDevice: `mobile` (default — same as PageSpeed Insights) or `desktop`. Slower than the other browser-dep agents (~10-20s per run) because Lighthouse intentionally simulates a slow 4G connection + CPU throttling to get representative scores.\n\nUse it for: pre-launch audits, CI gates on perf budgets, dashboards showing competitor scores, SEO monitoring.",
    category: "Web",
    tags: ["lighthouse", "performance", "core-web-vitals", "seo", "accessibility", "utility"],
    iconEmoji: "💡",
    accentHex: "#f97316",
    screenshots: ["Category scores", "Core Web Vitals", "Opportunities"],
    pricePerCall: 4,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri" },
        device: { type: "string", enum: ["mobile", "desktop"], default: "mobile" },
        categories: {
          type: "array",
          items: { type: "string", enum: ["performance", "accessibility", "best-practices", "seo"] },
          default: ["performance", "accessibility", "best-practices", "seo"],
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["finalUrl", "scores", "metrics", "device"],
      properties: {
        finalUrl: { type: "string", format: "uri" },
        scores: {
          type: "object",
          additionalProperties: { type: ["integer", "null"] },
        },
        metrics: {
          type: "object",
          properties: {
            firstContentfulPaintMs: { type: ["integer", "null"] },
            largestContentfulPaintMs: { type: ["integer", "null"] },
            totalBlockingTimeMs: { type: ["integer", "null"] },
            cumulativeLayoutShift: { type: ["number", "null"] },
            speedIndexMs: { type: ["integer", "null"] },
            timeToInteractiveMs: { type: ["integer", "null"] },
          },
        },
        network: {
          type: "object",
          properties: {
            totalBytes: { type: ["integer", "null"] },
            totalRequests: { type: ["integer", "null"] },
          },
        },
        opportunities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              estimatedSavingsMs: { type: ["integer", "null"] },
            },
          },
        },
        failedAccessibility: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "string" }, title: { type: "string" } },
          },
        },
        device: { type: "string" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: { url: "https://orqis.xyz", device: "mobile" },
    exampleResponse: {
      finalUrl: "https://orqis.xyz/",
      scores: { performance: 94, accessibility: 100, "best-practices": 100, seo: 100 },
      metrics: {
        firstContentfulPaintMs: 820,
        largestContentfulPaintMs: 1_240,
        totalBlockingTimeMs: 40,
        cumulativeLayoutShift: 0.002,
        speedIndexMs: 1_320,
        timeToInteractiveMs: 1_580,
      },
      network: { totalBytes: 412_881, totalRequests: 24 },
      opportunities: [],
      failedAccessibility: [],
      device: "mobile",
      durationMs: 12_410,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/lighthouse-audit/run",
  },

  // =====================================================================
  // Sprint 16 — pure-Node utility & validation agents that go head-to-head
  // with established paid APIs (MailboxLayer, mxtoolbox, SSL Labs,
  // Microlink, Twilio Lookup, axe-core). The pitch isn't "we invented this"
  // — it's "same checks, one credit balance, one MCP install line, and
  // your AI agent can call them too".
  // =====================================================================

  // ---------------------------------------------------------------------
  // email-truth — disposable / role / MX / syntax verdict.
  // ---------------------------------------------------------------------
  {
    slug: "email-truth",
    name: "email-truth",
    tagline: "Is this email real? Disposable + role + MX + syntax in one call.",
    description:
      "Send an email address; get back a verdict (valid / risky / fake), the reasons, and the underlying checks. Catches the bulk of fake signups without an SMTP probe.",
    longDescription:
      "email-truth runs five layered checks in parallel and rolls them up into a single verdict:\n\n1. **Syntax** — RFC-5322-lite validation.\n2. **Disposable** — match against the maintained `disposable-email-domains` list (~5,000 domains; mailinator, 10minutemail, guerrillamail, etc.).\n3. **Role account** — flag shared inboxes like `info@`, `admin@`, `support@`, `noreply@`.\n4. **Free provider** — Gmail, Outlook, Yahoo, iCloud, etc. — useful when you want to flag non-corporate emails.\n5. **MX lookup** — does the domain actually have mail servers?\n\nSub-100ms typical, no external API calls beyond DNS. SMTP probe is deferred to a `deepCheck` flag (not yet enabled) because major providers rate-limit it and abuse can hurt sender reputation.\n\nCompetes with: NeverBounce ($0.008/call), ZeroBounce ($0.0079), MailboxLayer (APILayer's flagship). Same job, marketplace pricing, and callable from any MCP client.",
    category: "Utilities",
    tags: ["email", "validation", "disposable", "mx", "fake-detection", "utility"],
    iconEmoji: "✉️",
    accentHex: "#16a34a",
    screenshots: ["Verdict + reasons", "All five checks", "Disposable flag"],
    pricePerCall: 1,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["email"],
      properties: {
        email: { type: "string", format: "email", maxLength: 320 },
      },
    },
    outputSchema: {
      type: "object",
      required: ["email", "verdict", "verdictReasons", "score", "checks"],
      properties: {
        email: { type: "string" },
        verdict: { type: "string", enum: ["valid", "risky", "fake"] },
        verdictReasons: { type: "array", items: { type: "string" } },
        score: { type: "number", description: "0-1; higher = more trustworthy." },
        checks: {
          type: "object",
          properties: {
            syntax: { type: "object", properties: { valid: { type: "boolean" } } },
            disposable: { type: "object" },
            roleAccount: { type: "object" },
            freeProvider: { type: "object" },
            mx: { type: "object" },
          },
        },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: { email: "test@mailinator.com" },
    exampleResponse: {
      email: "test@mailinator.com",
      verdict: "fake",
      verdictReasons: ["disposable_domain"],
      score: 0.1,
      checks: {
        syntax: { valid: true },
        disposable: { isDisposable: true, matchedSource: "disposable-email-domains" },
        roleAccount: { isRole: false, matchedLocal: null },
        freeProvider: { isFree: false, provider: null },
        mx: { hasMx: false, records: null, lookupError: null },
      },
      durationMs: 14,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/email-truth/run",
  },

  // ---------------------------------------------------------------------
  // dns-trace — full DNS audit + SPF / DMARC / DKIM parse.
  // ---------------------------------------------------------------------
  {
    slug: "dns-trace",
    name: "dns-trace",
    tagline: "Full DNS audit — A / AAAA / MX / NS / TXT / CAA + SPF / DMARC / DKIM parse.",
    description:
      "Pass a domain; get back every DNS record type that matters plus structured views of SPF, DMARC, and DKIM. The mxtoolbox of orqis.",
    longDescription:
      "dns-trace runs all seven major record-type queries in parallel and returns them in one shot, alongside a parsed view of the email-auth alphabet soup (SPF, DMARC, DKIM by selector).\n\nReturns: A, AAAA, MX (sorted by priority), NS, TXT, CAA, SOA. The `parsed` field surfaces the SPF / DMARC records as their raw strings (callers can lint them further) plus a DKIM selector probe across common defaults (`default`, `google`, `k1`, `selector1`, `selector2`) — or pass your own `includeDkimSelectors` list.\n\nThe `summary` rollup is the field most callers actually want: booleans for hasA / hasAaaa / hasMx / hasSpf / hasDmarc / hasCaa. Wire that into a status dashboard and you've replicated half of mxtoolbox.\n\nResolution goes through Node's built-in resolver — fast, respects system config. Cross-resolver propagation (Google vs Cloudflare vs Quad9) is a follow-up feature; requires raw UDP probes we didn't want to bring in for v1.",
    category: "Utilities",
    tags: ["dns", "mx", "spf", "dmarc", "dkim", "domain", "utility"],
    iconEmoji: "🌐",
    accentHex: "#0284c7",
    screenshots: ["All record types", "SPF / DMARC parse", "Summary rollup"],
    pricePerCall: 1,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["domain"],
      properties: {
        domain: { type: "string", maxLength: 253 },
        includeDkimSelectors: {
          type: "array",
          items: { type: "string" },
          maxItems: 8,
          description: "DKIM selectors to probe (default: ['default','google','k1','selector1','selector2']).",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["domain", "records", "parsed", "summary"],
      properties: {
        domain: { type: "string" },
        records: { type: "object" },
        parsed: { type: "object" },
        summary: { type: "object" },
        errors: { type: "object" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: { domain: "orqis.xyz" },
    exampleResponse: {
      domain: "orqis.xyz",
      records: {
        a: ["76.76.21.21"],
        aaaa: [],
        mx: [{ exchange: "feedback-smtp.us-east-1.amazonses.com", priority: 10 }],
        ns: ["ns1.vercel-dns.com", "ns2.vercel-dns.com"],
        txt: ["v=spf1 include:amazonses.com ~all"],
        caa: [],
        soa: null,
      },
      parsed: {
        spf: "v=spf1 include:amazonses.com ~all",
        dmarc: "v=DMARC1; p=quarantine; rua=mailto:dmarc@orqis.xyz",
        mxHosts: ["feedback-smtp.us-east-1.amazonses.com"],
        nsHosts: ["ns1.vercel-dns.com", "ns2.vercel-dns.com"],
        dkim: { default: null, google: null, k1: null, selector1: null, selector2: null },
      },
      summary: { hasA: true, hasAaaa: false, hasMx: true, hasSpf: true, hasDmarc: true, hasCaa: false },
      durationMs: 84,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/dns-trace/run",
  },

  // ---------------------------------------------------------------------
  // ssl-inspect — TLS cert chain + expiry + cipher.
  // ---------------------------------------------------------------------
  {
    slug: "ssl-inspect",
    name: "ssl-inspect",
    tagline: "TLS cert chain inspector. Expiry, SANs, cipher, hostname match.",
    description:
      "Connect to host:port, read the negotiated cert chain, return parsed metadata: issuer / subject / SANs / validity window / days until expiry / protocol / cipher.",
    longDescription:
      "ssl-inspect opens a real TLS handshake to the target host and returns everything the certificate dump tells you, in structured form:\n\n• **Chain** — every cert in the presented chain (leaf → intermediates → root if sent), parsed: subject, issuer, serial, validity window, signature algorithm, fingerprint, SANs.\n• **Cipher** — negotiated cipher suite (name, standardName, TLS version).\n• **Authorization** — Node's verify-by-default outcome plus the raw `authorizationError` if any. Toggle `rejectUnauthorized: false` to inspect self-signed or expired certs without tearing down.\n• **Summary** — daysUntilExpiry, isExpired, isExpiringSoon (<30d), matchesHost (SAN/CN check), hasWeakSignature (SHA-1 / MD5 flag).\n\nUse it for: cert-expiry monitoring (cron + Slack alert), pre-deployment checks, hardening audits, debugging CDN cert misconfiguration. 10-second connect timeout.",
    category: "Utilities",
    tags: ["ssl", "tls", "certificate", "expiry", "security", "utility"],
    iconEmoji: "🔐",
    accentHex: "#9333ea",
    screenshots: ["Cert chain", "Expiry countdown", "Cipher details"],
    pricePerCall: 1,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["host"],
      properties: {
        host: { type: "string", maxLength: 253 },
        port: { type: "integer", minimum: 1, maximum: 65535, default: 443 },
        servername: { type: "string", description: "Override SNI (defaults to host)." },
        rejectUnauthorized: {
          type: "boolean",
          default: true,
          description: "Set false to inspect self-signed / expired certs.",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["host", "port", "chain", "summary"],
      properties: {
        host: { type: "string" },
        port: { type: "integer" },
        protocol: { type: ["string", "null"] },
        cipher: { type: ["object", "null"] },
        authorized: { type: "boolean" },
        authorizationError: { type: ["string", "null"] },
        chain: { type: "array" },
        leaf: { type: ["object", "null"] },
        summary: { type: "object" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: { host: "orqis.xyz" },
    exampleResponse: {
      host: "orqis.xyz",
      port: 443,
      protocol: "TLSv1.3",
      cipher: { name: "TLS_AES_256_GCM_SHA384", version: "TLSv1.3" },
      authorized: true,
      authorizationError: null,
      chain: [
        {
          subject: "CN=orqis.xyz",
          issuer: "CN=E1, O=Let's Encrypt, C=US",
          serialNumber: "03ab…",
          validFrom: "2026-04-10T00:00:00.000Z",
          validTo: "2026-07-09T00:00:00.000Z",
          daysUntilExpiry: 67,
          signatureAlgorithm: "ecdsa-with-SHA384",
          fingerprint256: "AA:BB:CC:…",
          subjectAltNames: ["orqis.xyz", "www.orqis.xyz"],
          isSelfSigned: false,
          keyBits: 256,
        },
      ],
      leaf: {
        subject: "CN=orqis.xyz",
        issuer: "CN=E1, O=Let's Encrypt, C=US",
        serialNumber: "03ab…",
        validFrom: "2026-04-10T00:00:00.000Z",
        validTo: "2026-07-09T00:00:00.000Z",
        daysUntilExpiry: 67,
        signatureAlgorithm: "ecdsa-with-SHA384",
        fingerprint256: "AA:BB:CC:…",
        subjectAltNames: ["orqis.xyz", "www.orqis.xyz"],
        isSelfSigned: false,
        keyBits: 256,
      },
      summary: { daysUntilExpiry: 67, isExpired: false, isExpiringSoon: false, matchesHost: true, hasWeakSignature: false },
      durationMs: 240,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/ssl-inspect/run",
  },

  // ---------------------------------------------------------------------
  // og-card — Open Graph + Twitter card metadata.
  // ---------------------------------------------------------------------
  {
    slug: "og-card",
    name: "og-card",
    tagline: "Open Graph + Twitter card metadata from any URL. The Microlink alternative.",
    description:
      "Pass a URL; get back the OG title / description / image, Twitter card metadata, canonical, favicon, and language — all absolutized to full URLs.",
    longDescription:
      "og-card is the cheap, fast, no-browser meta extractor every link-preview UI needs. Fetch the URL, parse with cheerio, return:\n\n• `title`, `description`, `language`, `siteName`, `type` (OG type, e.g. article / video)\n• `image`, `imageAlt`, `imageWidth`, `imageHeight` — image URL absolutized against the page URL\n• `url_canonical` — the rel=canonical or og:url\n• `twitter` — card type, site, creator, title, description, image\n• `favicon` — best-guess from link[rel=icon] / shortcut icon / apple-touch-icon, absolutized\n\nNo headless browser, so it's fast (~200-500 ms) but misses metadata that's injected client-side. SPAs that hydrate their `<head>` after page load need scrape-render instead.\n\nCompetes with: Microlink ($), Iframely ($), OpenGraph.io. Same response shape (close enough that callers can swap us in), marketplace pricing.",
    category: "Web",
    tags: ["open-graph", "metadata", "link-preview", "twitter-card", "favicon", "utility"],
    iconEmoji: "🃏",
    accentHex: "#facc15",
    screenshots: ["OG preview card", "Twitter metadata", "Resolved favicon"],
    pricePerCall: 1,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: { url: { type: "string", format: "uri" } },
    },
    outputSchema: {
      type: "object",
      required: ["url", "finalUrl"],
      properties: {
        url: { type: "string" },
        finalUrl: { type: "string" },
        title: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
        language: { type: ["string", "null"] },
        siteName: { type: ["string", "null"] },
        url_canonical: { type: ["string", "null"] },
        image: { type: ["string", "null"] },
        imageAlt: { type: ["string", "null"] },
        imageWidth: { type: ["integer", "null"] },
        imageHeight: { type: ["integer", "null"] },
        type: { type: ["string", "null"] },
        twitter: { type: "object" },
        favicon: { type: ["string", "null"] },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: { url: "https://orqis.xyz" },
    exampleResponse: {
      url: "https://orqis.xyz",
      finalUrl: "https://orqis.xyz/",
      title: "orqis — The marketplace for specialist AI agents",
      description: "Browse and invoke specialist agents.",
      siteName: "orqis",
      image: "https://orqis.xyz/og.png",
      favicon: "https://orqis.xyz/favicon.ico",
      durationMs: 320,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/og-card/run",
  },

  // ---------------------------------------------------------------------
  // phone-truth — libphonenumber parse + validate.
  // ---------------------------------------------------------------------
  {
    slug: "phone-truth",
    name: "phone-truth",
    tagline: "Phone number validate, normalize, classify. libphonenumber, served.",
    description:
      "Send a phone number (any human format); get it back parsed, validated, normalized to E.164, with country / region / line-type classification.",
    longDescription:
      "phone-truth wraps libphonenumber-js — the JavaScript port of Google's reference phone-number library. Same library used internally by Twilio, WhatsApp, and most messaging platforms; we expose it as a one-call API.\n\nReturns:\n• `valid` (passes country-specific validation) + `possible` (looks plausibly like a phone number)\n• `country` (ISO 3166-1) + `countryCallingCode`\n• Formatted views: `national`, `international`, `e164`, `rfc3966`, `uri`\n• Line-type classification: `mobile`, `fixed_line`, `fixed_line_or_mobile`, `toll_free`, `premium_rate`, `voip`, `personal_number`, etc.\n• Convenience booleans: `isMobile`, `isFixed`, `isTollFree`, `isPremium`, `isVoip`\n\nUse `defaultCountry` (2-letter ISO code) when the input lacks a `+countryCode` prefix — parser uses it to disambiguate.\n\nCompetes with: Twilio Lookup ($0.005), Numverify (APILayer). Carrier-name lookup needs a paid HLR provider — we deliberately skip it for v1; everything else is offline-fast.",
    category: "Utilities",
    tags: ["phone", "validation", "libphonenumber", "e164", "country", "utility"],
    iconEmoji: "📞",
    accentHex: "#06b6d4",
    screenshots: ["Verdict + classification", "All formats", "Line-type flags"],
    pricePerCall: 1,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["phone"],
      properties: {
        phone: { type: "string", maxLength: 60 },
        defaultCountry: { type: "string", pattern: "^[A-Z]{2}$", description: "ISO 3166-1 2-letter code." },
      },
    },
    outputSchema: {
      type: "object",
      required: ["phone", "valid", "possible", "type"],
      properties: {
        phone: { type: "string" },
        valid: { type: "boolean" },
        possible: { type: "boolean" },
        country: { type: ["string", "null"] },
        countryCallingCode: { type: ["string", "null"] },
        national: { type: ["string", "null"] },
        international: { type: ["string", "null"] },
        e164: { type: ["string", "null"] },
        rfc3966: { type: ["string", "null"] },
        uri: { type: ["string", "null"] },
        type: { type: "string" },
        isMobile: { type: "boolean" },
        isFixed: { type: "boolean" },
        isTollFree: { type: "boolean" },
        isPremium: { type: "boolean" },
        isVoip: { type: "boolean" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: { phone: "+1 415 555 0173", defaultCountry: "US" },
    exampleResponse: {
      phone: "+1 415 555 0173",
      valid: true,
      possible: true,
      country: "US",
      countryCallingCode: "1",
      e164: "+14155550173",
      national: "(415) 555-0173",
      international: "+1 415 555 0173",
      rfc3966: "tel:+1-415-555-0173",
      uri: "tel:+14155550173",
      type: "fixed_line_or_mobile",
      isMobile: true,
      isFixed: true,
      isTollFree: false,
      isPremium: false,
      isVoip: false,
      durationMs: 6,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/phone-truth/run",
  },

  // ---------------------------------------------------------------------
  // a11y-quick — axe-core a11y audit in headless Chromium.
  // ---------------------------------------------------------------------
  {
    slug: "a11y-quick",
    name: "a11y-quick",
    tagline: "axe-core accessibility audit on any URL. Violations grouped by impact.",
    description:
      "Run axe-core (Deque's reference a11y rule engine) against any URL in headless Chromium. Returns violations grouped by impact (critical / serious / moderate / minor), a 0-100 score, and the top-15 issues with help URLs.",
    longDescription:
      "a11y-quick is the focused alternative to lighthouse-audit's accessibility category — same underlying engine (axe-core), faster runs (~3-5 s vs 10-20 s for full Lighthouse), no perf-throttling overhead.\n\nReturns:\n• `score` — 0-100 weighted rollup (critical=-10, serious=-6, moderate=-3, minor=-1 per violation). Roughly matches Lighthouse's a11y score on identical pages.\n• `counts.byImpact` — violation count per severity tier.\n• `counts.passes / incomplete / inapplicable` — context for the score.\n• `topViolations` — top 15 violations sorted by impact, with `id`, `description`, `helpUrl` (links to Deque docs), `nodeCount`, and a `selectorSample` so callers can locate the issue without parsing the full axe report.\n\nUses the Playwright Chromium install from Sprint 15 — no extra browser dep. SSRF-guarded URL fetch.\n\nUse it for: a11y-conscious CI gates, accessibility-monitoring dashboards, design-review tools, agency reports.",
    category: "Web",
    tags: ["accessibility", "a11y", "axe-core", "audit", "wcag", "utility"],
    iconEmoji: "♿",
    accentHex: "#0891b2",
    screenshots: ["Score + counts", "Impact breakdown", "Top violations"],
    pricePerCall: 2,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri" },
        device: { type: "string", enum: ["desktop", "mobile"], default: "desktop" },
        waitUntil: {
          type: "string",
          enum: ["load", "domcontentloaded", "networkidle"],
          default: "networkidle",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["url", "finalUrl", "score", "counts"],
      properties: {
        url: { type: "string" },
        finalUrl: { type: "string" },
        device: { type: "string" },
        score: { type: "integer" },
        counts: { type: "object" },
        topViolations: { type: "array" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: { url: "https://orqis.xyz", device: "desktop" },
    exampleResponse: {
      url: "https://orqis.xyz",
      finalUrl: "https://orqis.xyz/",
      device: "desktop",
      score: 96,
      counts: {
        violations: 2,
        passes: 41,
        incomplete: 0,
        inapplicable: 14,
        byImpact: { critical: 0, serious: 0, moderate: 1, minor: 1, unknown: 0 },
      },
      durationMs: 3_120,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/a11y-quick/run",
  },

  // =====================================================================
  // Sprint 17 — Tier D: LLM access. Three product shapes in one batch:
  //   A. Markup resell (claude-chat, gpt-chat, gemini-chat, nano-banana)
  //   B. Product wrappers (text-summarize, entity-extract, code-explain,
  //      compare-models) — use orqis's own LLM keys internally
  //   C. BYO-key bundling — same A endpoints accept input.apiKey and drop
  //      to a 1-credit routing fee instead of the full credit price
  //
  // TOS note: A is the highest-risk shape. Provider terms (Anthropic /
  // OpenAI / Google) generally prohibit reselling raw API access. Flagged
  // for legal review before public launch.
  // =====================================================================

  // ---------------------------------------------------------------------
  // claude-chat — Anthropic API passthrough (dual-mode managed / BYO).
  // ---------------------------------------------------------------------
  {
    slug: "claude-chat",
    name: "claude-chat",
    tagline: "Claude (Anthropic) chat completion. Managed credits OR bring your own key.",
    description:
      "Single-turn or multi-turn chat completion via the Anthropic API. Pass `messages[]` like you would directly. Pass an `apiKey` for BYO mode (1 credit routing fee) or rely on orqis's managed key (full credit price).",
    longDescription:
      "claude-chat is the catalogue's direct Claude entry. Identical request shape to the Anthropic API's `messages.create` — `messages`, `model`, `systemPrompt`, `maxTokens`, `temperature` — so existing Claude code ports over by swapping the endpoint.\n\n**Modes:**\n• **Managed** — set `ANTHROPIC_API_KEY` on the orqis-owned-services host. Buyers pay 10 credits per call; orqis pays Anthropic. Margin depends on prompt size and model choice.\n• **BYO key** — pass `apiKey` in the request body. orqis charges 1 credit for routing + the MCP / SDK convenience; you pay Anthropic directly via your own account. Your key is never logged or stored.\n• **Mock** — neither set → canned echo response. For dev / CI.\n\nValid models: claude-opus-4-7, claude-opus-4-8, claude-sonnet-4-6 (default), claude-haiku-4-5-20251001.\n\nNon-streaming for now — orqis's invocation contract is JSON-in / JSON-out. Streaming is a follow-up once the platform supports SSE responses.",
    category: "LLM",
    tags: ["claude", "anthropic", "llm", "chat-completion", "passthrough", "byok"],
    iconEmoji: "🟪",
    accentHex: "#d97706",
    screenshots: ["Single-turn", "Multi-turn with system prompt", "BYO key mode"],
    pricePerCall: 10,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["messages"],
      properties: {
        messages: {
          type: "array",
          minItems: 1,
          maxItems: 64,
          items: {
            type: "object",
            required: ["role", "content"],
            properties: {
              role: { type: "string", enum: ["user", "assistant"] },
              content: { type: "string", maxLength: 100000 },
            },
          },
        },
        model: { type: "string", default: "claude-sonnet-4-6" },
        systemPrompt: { type: "string" },
        maxTokens: { type: "integer", minimum: 1, maximum: 8192, default: 1024 },
        temperature: { type: "number", minimum: 0, maximum: 1, default: 1 },
        apiKey: { type: "string", description: "BYO Anthropic key. When set, routing fee is 1 credit instead of full price." },
      },
    },
    outputSchema: {
      type: "object",
      required: ["text", "model", "mode", "usage"],
      properties: {
        text: { type: "string" },
        model: { type: "string" },
        mode: { type: "string", enum: ["byok", "managed", "mock"] },
        stopReason: { type: ["string", "null"] },
        usage: {
          type: "object",
          properties: { inputTokens: { type: "integer" }, outputTokens: { type: "integer" } },
        },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      messages: [{ role: "user", content: "Explain marketplaces in one sentence." }],
      model: "claude-haiku-4-5-20251001",
      maxTokens: 128,
    },
    exampleResponse: {
      text: "A marketplace is a shared shelf where many sellers' goods meet many buyers, with the platform handling discovery, trust, and payment so neither side has to build it themselves.",
      model: "claude-haiku-4-5-20251001",
      mode: "managed",
      stopReason: "end_turn",
      usage: { inputTokens: 18, outputTokens: 41 },
      durationMs: 612,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/claude-chat/run",
  },

  // ---------------------------------------------------------------------
  // gpt-chat — OpenAI API passthrough.
  // ---------------------------------------------------------------------
  {
    slug: "gpt-chat",
    name: "gpt-chat",
    tagline: "OpenAI GPT chat completion. Managed credits OR bring your own key.",
    description:
      "Single-turn or multi-turn chat completion via the OpenAI Chat Completions API. Same request shape (`messages` with role / content) as the official SDK. BYO key supported.",
    longDescription:
      "gpt-chat exposes OpenAI's Chat Completions API as an orqis agent. Drop-in replacement for callers already using `openai.chat.completions.create` — swap the endpoint, keep the payload.\n\n**Modes:**\n• **Managed** — set `OPENAI_API_KEY` on the orqis-owned-services host. Buyers pay 10 credits per call; orqis pays OpenAI.\n• **BYO key** — pass `apiKey` in the request body for the 1-credit routing fee.\n• **Mock** — neither set → canned echo response.\n\nModel id is permissive — pass `gpt-4o-mini` (default), `gpt-4o`, `gpt-5` (when available), or any current OpenAI model string. We don't gate behind a stale enum.\n\nSupports `system` messages (unlike claude-chat which uses a top-level `systemPrompt`) — matches OpenAI's native shape exactly.",
    category: "LLM",
    tags: ["openai", "gpt", "llm", "chat-completion", "passthrough", "byok"],
    iconEmoji: "🟢",
    accentHex: "#10b981",
    screenshots: ["Single-turn", "System + user + assistant", "BYO key mode"],
    pricePerCall: 10,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["messages"],
      properties: {
        messages: {
          type: "array",
          minItems: 1,
          maxItems: 64,
          items: {
            type: "object",
            required: ["role", "content"],
            properties: {
              role: { type: "string", enum: ["user", "assistant", "system"] },
              content: { type: "string", maxLength: 100000 },
            },
          },
        },
        model: { type: "string", default: "gpt-4o-mini" },
        maxTokens: { type: "integer", minimum: 1, maximum: 8192, default: 1024 },
        temperature: { type: "number", minimum: 0, maximum: 2, default: 1 },
        apiKey: { type: "string", description: "BYO OpenAI key. When set, routing fee is 1 credit." },
      },
    },
    outputSchema: {
      type: "object",
      required: ["text", "model", "mode", "usage"],
      properties: {
        text: { type: "string" },
        model: { type: "string" },
        mode: { type: "string", enum: ["byok", "managed", "mock"] },
        finishReason: { type: ["string", "null"] },
        usage: {
          type: "object",
          properties: { inputTokens: { type: "integer" }, outputTokens: { type: "integer" } },
        },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      messages: [
        { role: "system", content: "You explain things in one sentence." },
        { role: "user", content: "What is orqis?" },
      ],
      model: "gpt-4o-mini",
    },
    exampleResponse: {
      text: "Orqis is a marketplace where specialist AI agents and APIs are discoverable and callable by both humans and other AI agents.",
      model: "gpt-4o-mini",
      mode: "managed",
      finishReason: "stop",
      usage: { inputTokens: 24, outputTokens: 28 },
      durationMs: 412,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/gpt-chat/run",
  },

  // ---------------------------------------------------------------------
  // gemini-chat — Google Gemini API passthrough.
  // ---------------------------------------------------------------------
  {
    slug: "gemini-chat",
    name: "gemini-chat",
    tagline: "Google Gemini chat completion. Managed credits OR bring your own key.",
    description:
      "Chat completion via the Google Gemini API. Same flat `messages[]` shape as claude-chat / gpt-chat — orqis translates to Gemini's `contents` / `parts` structure on your behalf.",
    longDescription:
      "gemini-chat exposes Google's Gemini API behind orqis's shared chat shape. Pass the same `messages` array you'd send to claude-chat or gpt-chat — orqis maps `role: 'assistant'` to Gemini's `role: 'model'` and wraps content in `parts: [{text}]`.\n\n**Modes:**\n• **Managed** — set `GEMINI_API_KEY` on the orqis-owned-services host. Buyers pay 5 credits per call (Gemini's pricing is more aggressive than the others).\n• **BYO key** — pass `apiKey` in the request body for the 1-credit routing fee.\n• **Mock** — neither set → canned echo response.\n\nDefault model: `gemini-2.5-flash`. Pass any current Gemini model id (`gemini-2.5-pro`, etc.). Supports `systemPrompt` via Gemini's `systemInstruction`.",
    category: "LLM",
    tags: ["gemini", "google", "llm", "chat-completion", "passthrough", "byok"],
    iconEmoji: "🔷",
    accentHex: "#3b82f6",
    screenshots: ["Single-turn", "System prompt", "BYO key mode"],
    pricePerCall: 5,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["messages"],
      properties: {
        messages: {
          type: "array",
          minItems: 1,
          maxItems: 64,
          items: {
            type: "object",
            required: ["role", "content"],
            properties: {
              role: { type: "string", enum: ["user", "assistant"] },
              content: { type: "string", maxLength: 100000 },
            },
          },
        },
        model: { type: "string", default: "gemini-2.5-flash" },
        systemPrompt: { type: "string" },
        maxTokens: { type: "integer", minimum: 1, maximum: 8192, default: 1024 },
        temperature: { type: "number", minimum: 0, maximum: 2, default: 1 },
        apiKey: { type: "string", description: "BYO Gemini key. When set, routing fee is 1 credit." },
      },
    },
    outputSchema: {
      type: "object",
      required: ["text", "model", "mode", "usage"],
      properties: {
        text: { type: "string" },
        model: { type: "string" },
        mode: { type: "string", enum: ["byok", "managed", "mock"] },
        finishReason: { type: ["string", "null"] },
        usage: {
          type: "object",
          properties: { inputTokens: { type: "integer" }, outputTokens: { type: "integer" } },
        },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      messages: [{ role: "user", content: "Explain marketplaces in one sentence." }],
      model: "gemini-2.5-flash",
    },
    exampleResponse: {
      text: "Marketplaces aggregate supply from many sellers and demand from many buyers, with the platform owning discovery, trust, and settlement.",
      model: "gemini-2.5-flash",
      mode: "managed",
      finishReason: "STOP",
      usage: { inputTokens: 14, outputTokens: 32 },
      durationMs: 318,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/gemini-chat/run",
  },

  // ---------------------------------------------------------------------
  // Sprint 18 — budget LLM tier via OpenRouter. Same A + C shapes as the
  // three passthroughs above, but priced at 2 credits because the underlying
  // models cost ~10-50× less per token than Claude / GPT-4o. In managed
  // mode each listing enforces a model allowlist so a caller can't route a
  // 2-credit call to a frontier model on orqis's key; BYO-key mode lifts
  // the allowlist (their OpenRouter account, their bill).
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // deepseek-chat — DeepSeek V3 / R1 via OpenRouter.
  // ---------------------------------------------------------------------
  {
    slug: "deepseek-chat",
    name: "deepseek-chat",
    tagline: "DeepSeek V3 chat completion at 2 credits — the cheap default for high-volume work.",
    description:
      "Chat completion on DeepSeek V3 (default) or DeepSeek R1 for reasoning, routed through OpenRouter. Same `messages[]` shape as gpt-chat. 2 credits managed, 1 credit with your own OpenRouter key.",
    longDescription:
      "deepseek-chat is the budget entry point for callers who need a lot of tokens and don't need a frontier model: summarising scraped pages, classifying tickets, drafting first passes, running eval loops. DeepSeek V3 is roughly 10× cheaper per token than GPT-4o with comparable quality on everyday tasks.\n\n**Modes:**\n• **Managed** — set `OPENROUTER_API_KEY` on the orqis-owned-services host. Buyers pay 2 credits per call. Allowed models: `deepseek/deepseek-chat` (default), `deepseek/deepseek-r1`.\n• **BYO key** — pass your own OpenRouter `apiKey` (`sk-or-v1-…`). 1-credit routing fee, any OpenRouter model id accepted. Your key is never logged or stored.\n• **Mock** — neither set → canned echo response.\n\nThe response includes `usage.costUsd` (OpenRouter reports actual spend per call) so you can see exactly what a request cost upstream.\n\nManaged mode caps `maxTokens` at 4096. Non-streaming.",
    category: "LLM",
    tags: ["deepseek", "openrouter", "llm", "chat-completion", "budget", "byok"],
    iconEmoji: "🐳",
    accentHex: "#2563eb",
    screenshots: ["Single-turn", "R1 reasoning mode", "BYO key mode"],
    pricePerCall: 2,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["messages"],
      properties: {
        messages: {
          type: "array",
          minItems: 1,
          maxItems: 64,
          items: {
            type: "object",
            required: ["role", "content"],
            properties: {
              role: { type: "string", enum: ["user", "assistant", "system"] },
              content: { type: "string", maxLength: 100000 },
            },
          },
        },
        model: {
          type: "string",
          default: "deepseek/deepseek-chat",
          description: "OpenRouter slug. Managed mode allows deepseek/deepseek-chat or deepseek/deepseek-r1; BYO mode accepts any.",
        },
        maxTokens: { type: "integer", minimum: 1, maximum: 8192, default: 1024 },
        temperature: { type: "number", minimum: 0, maximum: 2, default: 1 },
        apiKey: { type: "string", description: "BYO OpenRouter key (sk-or-v1-…). When set, routing fee is 1 credit and any model is allowed." },
      },
    },
    outputSchema: {
      type: "object",
      required: ["text", "model", "mode", "usage"],
      properties: {
        text: { type: "string" },
        model: { type: "string" },
        mode: { type: "string", enum: ["byok", "managed", "mock"] },
        finishReason: { type: ["string", "null"] },
        usage: {
          type: "object",
          properties: {
            inputTokens: { type: "integer" },
            outputTokens: { type: "integer" },
            costUsd: { type: ["number", "null"], description: "Actual upstream spend reported by OpenRouter." },
          },
        },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      messages: [{ role: "user", content: "Classify this support ticket as billing, bug, or feature: 'I was charged twice this month.'" }],
      maxTokens: 32,
    },
    exampleResponse: {
      text: "billing",
      model: "deepseek/deepseek-chat",
      mode: "managed",
      finishReason: "stop",
      usage: { inputTokens: 31, outputTokens: 2, costUsd: 0.000012 },
      durationMs: 540,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/deepseek-chat/run",
  },

  // ---------------------------------------------------------------------
  // mimo-chat — Xiaomi MiMo V2 Flash via OpenRouter.
  // ---------------------------------------------------------------------
  {
    slug: "mimo-chat",
    name: "mimo-chat",
    tagline: "Xiaomi MiMo V2 Flash — fast, very cheap chat completion for latency-sensitive calls.",
    description:
      "Chat completion on Xiaomi's MiMo V2 Flash via OpenRouter. Small-footprint MoE model tuned for speed; well suited to agent inner loops, autocomplete, and high-QPS classification. 2 credits managed, 1 with your own key.",
    longDescription:
      "mimo-chat wraps Xiaomi's MiMo V2 Flash — a sparse mixture-of-experts model that trades a little frontier quality for much lower latency and cost. Use it where you'd otherwise reach for a `-mini` / `-flash` model: routing decisions inside an agent loop, tagging, rewriting, quick Q&A over short context.\n\n**Modes:**\n• **Managed** — set `OPENROUTER_API_KEY` on the orqis-owned-services host. Buyers pay 2 credits per call. Allowed model: `xiaomi/mimo-v2-flash`.\n• **BYO key** — pass your own OpenRouter `apiKey`. 1-credit routing fee, any model id accepted.\n• **Mock** — neither set → canned echo response.\n\nResponse includes `usage.costUsd` from OpenRouter. Managed mode caps `maxTokens` at 4096. Non-streaming.",
    category: "LLM",
    tags: ["mimo", "xiaomi", "openrouter", "llm", "chat-completion", "budget", "byok", "fast"],
    iconEmoji: "⚡",
    accentHex: "#f97316",
    screenshots: ["Single-turn", "Agent-loop routing", "BYO key mode"],
    pricePerCall: 2,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["messages"],
      properties: {
        messages: {
          type: "array",
          minItems: 1,
          maxItems: 64,
          items: {
            type: "object",
            required: ["role", "content"],
            properties: {
              role: { type: "string", enum: ["user", "assistant", "system"] },
              content: { type: "string", maxLength: 100000 },
            },
          },
        },
        model: { type: "string", default: "xiaomi/mimo-v2-flash" },
        maxTokens: { type: "integer", minimum: 1, maximum: 8192, default: 1024 },
        temperature: { type: "number", minimum: 0, maximum: 2, default: 1 },
        apiKey: { type: "string", description: "BYO OpenRouter key. When set, routing fee is 1 credit and any model is allowed." },
      },
    },
    outputSchema: {
      type: "object",
      required: ["text", "model", "mode", "usage"],
      properties: {
        text: { type: "string" },
        model: { type: "string" },
        mode: { type: "string", enum: ["byok", "managed", "mock"] },
        finishReason: { type: ["string", "null"] },
        usage: {
          type: "object",
          properties: {
            inputTokens: { type: "integer" },
            outputTokens: { type: "integer" },
            costUsd: { type: ["number", "null"] },
          },
        },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      messages: [
        { role: "system", content: "Reply with a single word: the user's intent." },
        { role: "user", content: "Can you cancel my order from yesterday?" },
      ],
      maxTokens: 8,
    },
    exampleResponse: {
      text: "cancel",
      model: "xiaomi/mimo-v2-flash",
      mode: "managed",
      finishReason: "stop",
      usage: { inputTokens: 26, outputTokens: 1, costUsd: 0.000003 },
      durationMs: 210,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/mimo-chat/run",
  },

  // ---------------------------------------------------------------------
  // budget-chat — pick any model from the curated cheap tier.
  // ---------------------------------------------------------------------
  {
    slug: "budget-chat",
    name: "budget-chat",
    tagline: "One endpoint, every budget model: DeepSeek, MiMo, Qwen, Llama, Gemini Flash Lite, Kimi, GLM.",
    description:
      "Chat completion across a curated allowlist of cheap OpenRouter models. Pass a `model` slug to pick one, or omit it for DeepSeek V3. Handy for A/B-ing cheap models without changing endpoints. 2 credits managed, 1 with your own key.",
    longDescription:
      "budget-chat is the catch-all for the cheap tier. Instead of one listing per vendor, it exposes a single endpoint over every model orqis has vetted as low-cost, so you can switch models by changing one string.\n\n**Managed-mode allowlist** (all via OpenRouter):\n• `deepseek/deepseek-chat` (default) — DeepSeek V3\n• `deepseek/deepseek-r1` — DeepSeek R1, reasoning\n• `xiaomi/mimo-v2-flash` — MiMo V2 Flash\n• `qwen/qwen3-30b-a3b` — Qwen3 30B-A3B\n• `meta-llama/llama-3.3-70b-instruct` — Llama 3.3 70B\n• `google/gemini-2.5-flash-lite` — Gemini 2.5 Flash Lite\n• `moonshotai/kimi-k2` — Kimi K2\n• `z-ai/glm-4.5-air` — GLM 4.5 Air\n\n`GET /v1/agents/budget-chat` on the owned-services host returns the live allowlist plus approximate per-token pricing, so you don't have to hard-code this list.\n\n**Modes:**\n• **Managed** — `OPENROUTER_API_KEY` set on the host; 2 credits per call; allowlisted models only (requests for anything else get a 400 with the allowlist in the message).\n• **BYO key** — pass your own OpenRouter `apiKey`; 1-credit routing fee; any OpenRouter model id accepted, including `:free` variants.\n• **Mock** — canned echo.\n\nResponse includes `usage.costUsd`. Managed mode caps `maxTokens` at 4096. Non-streaming.",
    category: "LLM",
    tags: ["openrouter", "llm", "chat-completion", "budget", "byok", "multi-model", "deepseek", "qwen", "llama"],
    iconEmoji: "🪙",
    accentHex: "#16a34a",
    screenshots: ["Model picker", "Cost per call", "BYO key mode"],
    pricePerCall: 2,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["messages"],
      properties: {
        messages: {
          type: "array",
          minItems: 1,
          maxItems: 64,
          items: {
            type: "object",
            required: ["role", "content"],
            properties: {
              role: { type: "string", enum: ["user", "assistant", "system"] },
              content: { type: "string", maxLength: 100000 },
            },
          },
        },
        model: {
          type: "string",
          default: "deepseek/deepseek-chat",
          description: "OpenRouter slug (vendor/model). Managed mode: must be on the budget allowlist. BYO mode: any.",
        },
        maxTokens: { type: "integer", minimum: 1, maximum: 8192, default: 1024 },
        temperature: { type: "number", minimum: 0, maximum: 2, default: 1 },
        apiKey: { type: "string", description: "BYO OpenRouter key. When set, routing fee is 1 credit and the allowlist is lifted." },
      },
    },
    outputSchema: {
      type: "object",
      required: ["text", "model", "mode", "usage"],
      properties: {
        text: { type: "string" },
        model: { type: "string" },
        mode: { type: "string", enum: ["byok", "managed", "mock"] },
        finishReason: { type: ["string", "null"] },
        usage: {
          type: "object",
          properties: {
            inputTokens: { type: "integer" },
            outputTokens: { type: "integer" },
            costUsd: { type: ["number", "null"] },
          },
        },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      messages: [{ role: "user", content: "Rewrite in plain English: 'Leverage synergies to operationalize our go-forward strategy.'" }],
      model: "qwen/qwen3-30b-a3b",
      maxTokens: 64,
    },
    exampleResponse: {
      text: "Work together to actually carry out our plan.",
      model: "qwen/qwen3-30b-a3b",
      mode: "managed",
      finishReason: "stop",
      usage: { inputTokens: 29, outputTokens: 10, costUsd: 0.000006 },
      durationMs: 480,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/budget-chat/run",
  },

  // ---------------------------------------------------------------------
  // nano-banana — Gemini image generation passthrough.
  // ---------------------------------------------------------------------
  {
    slug: "nano-banana",
    name: "nano-banana",
    tagline: "Raw Gemini image generation. Prompt in, PNG out.",
    description:
      "Direct passthrough to Gemini's image-gen model (gemini-2.5-flash-image-preview, a.k.a. 'nano-banana'). Different from poster-forge: poster-forge wraps Gemini in a typographic pipeline, this is the raw call.",
    longDescription:
      "nano-banana is the catalogue's straight image-gen endpoint. Pass a prompt and (optionally) an aspect ratio; get back a PNG hosted under /r/.\n\n**When to use this vs poster-forge:**\n• Use nano-banana when you want full control over the prompt and just need the raw artwork.\n• Use poster-forge when you want orqis to plan a typographic layout (title, subtitle, event details) and composite real text over the generated background. nano-banana doesn't do text rendering reliably.\n\n**Modes:**\n• **Managed** — set `GEMINI_API_KEY`. Buyers pay 15 credits per call (image-gen is the priciest tier).\n• **BYO key** — pass `apiKey` for the 1-credit routing fee; your Gemini account pays for the image.\n• **Mock** — neither set → returns an SVG-composited placeholder showing your prompt + a 'MOCK' badge.\n\nAspect ratios: 1:1 (1024x1024), 4:3, 3:4, 16:9, 9:16. Prompt cap: 4,000 chars.",
    category: "LLM",
    tags: ["gemini", "image-gen", "nano-banana", "llm", "passthrough", "byok"],
    iconEmoji: "🍌",
    accentHex: "#facc15",
    screenshots: ["Prompt → image", "Aspect ratio options", "Mock placeholder"],
    pricePerCall: 15,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", maxLength: 4000 },
        aspectRatio: { type: "string", enum: ["1:1", "4:3", "3:4", "16:9", "9:16"], default: "1:1" },
        apiKey: { type: "string", description: "BYO Gemini key. When set, routing fee is 1 credit." },
      },
    },
    outputSchema: {
      type: "object",
      required: ["previewUrl", "mode", "width", "height"],
      properties: {
        previewUrl: { type: "string", format: "uri" },
        downloadUrl: { type: "string", format: "uri" },
        mode: { type: "string", enum: ["byok", "managed", "mock"] },
        width: { type: "integer" },
        height: { type: "integer" },
        outputBytes: { type: "integer" },
        promptUsed: { type: "string" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      prompt: "a small wooden bookshelf with potted plants, soft afternoon light, watercolor",
      aspectRatio: "1:1",
    },
    exampleResponse: {
      previewUrl: "http://localhost:4000/r/a4b1.png",
      downloadUrl: "http://localhost:4000/r/a4b1.png",
      mode: "managed",
      width: 1024,
      height: 1024,
      outputBytes: 412_881,
      promptUsed: "a small wooden bookshelf with potted plants, soft afternoon light, watercolor",
      durationMs: 3_240,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/nano-banana/run",
  },

  // ---------------------------------------------------------------------
  // text-summarize — product wrapper using Claude Haiku.
  // ---------------------------------------------------------------------
  {
    slug: "text-summarize",
    name: "text-summarize",
    tagline: "Summarize text to a target word count. Four styles.",
    description:
      "Hand it any text up to 200k chars; get back a summary in the style you pick (neutral / executive / bulleted / casual) capped at your requested word count.",
    longDescription:
      "text-summarize is the catalogue's bread-and-butter LLM product. Uses Claude Haiku internally because for prose summarisation the quality gap vs Sonnet is small and the cost gap is significant.\n\n**Styles:**\n• `neutral` — clear, neutral-tone\n• `executive` — headline + 2-4 supporting bullets + risks / open questions\n• `bulleted` — pure bullet list, no preamble\n• `casual` — conversational\n\n**Mock fallback** — when no LLM key is set, falls back to an extractive heuristic that picks the first / middle / last sentence. Pipeline still works in dev / CI.",
    category: "LLM",
    tags: ["summarize", "llm", "claude-haiku", "rag", "wrapper"],
    iconEmoji: "📝",
    accentHex: "#0ea5e9",
    screenshots: ["Neutral summary", "Executive style", "Bulleted style"],
    pricePerCall: 3,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string", maxLength: 200000 },
        maxWords: { type: "integer", minimum: 20, maximum: 800, default: 120 },
        style: { type: "string", enum: ["neutral", "executive", "bulleted", "casual"], default: "neutral" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["summary", "wordCount", "style", "mode"],
      properties: {
        summary: { type: "string" },
        wordCount: { type: "integer" },
        style: { type: "string" },
        mode: { type: "string", enum: ["managed", "mock"] },
        modelUsed: { type: "string" },
        inputChars: { type: "integer" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      text: "Marketplaces aggregate supply and demand. The platform owns trust and discovery so neither side has to build it themselves. ... [long text]",
      maxWords: 60,
      style: "executive",
    },
    exampleResponse: {
      summary: "Marketplaces aggregate supply and demand under platform-owned trust and discovery.\n\n• Two-sided model removes friction for both buyers and sellers.\n• Platform's defensibility is network effects, not features.",
      wordCount: 32,
      style: "executive",
      mode: "managed",
      modelUsed: "claude-haiku-4-5-20251001",
      inputChars: 2_104,
      durationMs: 740,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/text-summarize/run",
  },

  // ---------------------------------------------------------------------
  // entity-extract — structured entity extraction.
  // ---------------------------------------------------------------------
  {
    slug: "entity-extract",
    name: "entity-extract",
    tagline: "Pull structured entities from any text. 8 presets + custom JSON Schema.",
    description:
      "Pass text + a preset (people, places, dates, emails, phones, urls, money, products) OR your own JSON Schema; get structured JSON back. Claude Sonnet internally.",
    longDescription:
      "entity-extract is the JSON-shaped LLM call every backend ends up writing. We did it once so you don't have to.\n\n**Two modes:**\n• `preset` — pick from 8 common entity kinds. Schema is pre-defined.\n• `schema` — hand us a JSON Schema describing the exact shape you want. We instruct the LLM to return JSON matching it.\n\n**Mock fallback** — for the four presets that map to regex (emails, urls, phones, dates), mock mode runs regex extraction and returns matched strings. Surprisingly useful in dev. Object-shaped presets (people, places, money, products) need an LLM and return a note in mock mode.\n\nClaude Sonnet (not Haiku) because structured-output reliability matters more than speed here.",
    category: "LLM",
    tags: ["entity-extraction", "structured-output", "ner", "llm", "claude-sonnet", "wrapper"],
    iconEmoji: "🧬",
    accentHex: "#a855f7",
    screenshots: ["8 presets", "Custom JSON Schema", "Regex-based mock fallback"],
    pricePerCall: 5,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["text"],
      oneOf: [{ required: ["preset"] }, { required: ["schema"] }],
      properties: {
        text: { type: "string", maxLength: 100000 },
        preset: {
          type: "string",
          enum: ["people", "places", "dates", "emails", "phones", "urls", "money", "products"],
        },
        schema: { type: "object", description: "JSON Schema describing the desired output shape." },
      },
    },
    outputSchema: {
      type: "object",
      required: ["entities", "preset", "mode"],
      properties: {
        entities: {},
        preset: { type: "string" },
        mode: { type: "string", enum: ["managed", "mock"] },
        modelUsed: { type: "string" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      text: "Email me at jane@example.com or call +1 415 555 0173. Visit https://orqis.xyz to learn more.",
      preset: "emails",
    },
    exampleResponse: {
      entities: ["jane@example.com"],
      preset: "emails",
      mode: "managed",
      modelUsed: "claude-sonnet-4-6",
      durationMs: 612,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/entity-extract/run",
  },

  // ---------------------------------------------------------------------
  // code-explain — code explanation tuned to audience + focus.
  // ---------------------------------------------------------------------
  {
    slug: "code-explain",
    name: "code-explain",
    tagline: "Explain code, tuned to audience and focus.",
    description:
      "Pass a code block + audience (beginner / intermediate / senior / tech-lead); get back prose + key takeaways. Optional `focusOn` (performance / security / readability / specific question).",
    longDescription:
      "code-explain is the LLM-wrapper version of 'rubber-duck explain this code'. Designed to be useful at four different reader levels:\n\n• `beginner` — defines jargon, walks line-by-line\n• `intermediate` (default) — assumes language fluency, explains the codebase-specific bits\n• `senior` — leads with architectural shape and trade-offs, skips basics\n• `tech-lead` — leads with risks and review-blocker concerns\n\nReturns `explanation` (multi-paragraph prose) + `bullets[]` (the 3-7 most important takeaways extracted from the explanation).\n\nClaude Sonnet internally for the structured-output reliability. Accepts code up to 60k chars (~15k tokens at typical density).",
    category: "LLM",
    tags: ["code-explain", "code-review", "documentation", "llm", "claude-sonnet", "wrapper"],
    iconEmoji: "🧠",
    accentHex: "#ec4899",
    screenshots: ["Intermediate explanation", "Tech-lead review notes", "Focus: security"],
    pricePerCall: 5,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["code"],
      properties: {
        code: { type: "string", maxLength: 60000 },
        language: { type: "string", maxLength: 32 },
        audience: { type: "string", enum: ["beginner", "intermediate", "senior", "tech-lead"], default: "intermediate" },
        focusOn: { type: "string", maxLength: 200 },
      },
    },
    outputSchema: {
      type: "object",
      required: ["explanation", "bullets", "language", "audience"],
      properties: {
        explanation: { type: "string" },
        bullets: { type: "array", items: { type: "string" } },
        language: { type: "string" },
        audience: { type: "string" },
        mode: { type: "string", enum: ["managed", "mock"] },
        modelUsed: { type: "string" },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      code: "function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }",
      language: "javascript",
      audience: "beginner",
    },
    exampleResponse: {
      explanation: "This is a debounce helper — it takes a function and a delay, and returns a new function that only calls the original after the delay has passed without further calls...",
      bullets: [
        "Useful for input handlers — only run after the user stops typing.",
        "`t` holds the pending timeout id so we can cancel it on the next call.",
        "Spread `...a` preserves all arguments through to the original `fn`.",
      ],
      language: "javascript",
      audience: "beginner",
      mode: "managed",
      modelUsed: "claude-sonnet-4-6",
      durationMs: 920,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/code-explain/run",
  },

  // ---------------------------------------------------------------------
  // compare-models — three-provider race.
  // ---------------------------------------------------------------------
  {
    slug: "compare-models",
    name: "compare-models",
    tagline: "Same prompt → Claude + GPT + Gemini side-by-side. Pick a winner.",
    description:
      "Fan one prompt out to Claude, GPT, and Gemini in parallel. Get back all three responses + per-provider latency + token counts. Pick which one to ship.",
    longDescription:
      "compare-models is the orqis catalogue's killer demo agent: the dual-audience pitch made literal. Hand it a prompt, get back three responses side-by-side from three different vendors via one orqis credit charge.\n\n**Why this exists:**\n1. **Pre-launch evals** — testing prompt quality across providers without wiring three SDKs.\n2. **Vendor diversification** — find the cheapest provider that's 'good enough' for your task.\n3. **Robustness** — failover when one provider rate-limits you.\n\n**Behavior:**\n• Runs all three providers in `Promise.all` (true parallel, ~slowest-of-three latency).\n• Per-provider failures are non-fatal — failing slot just shows an error message and continues.\n• Returns `fastest` for the provider that finished first among successful runs.\n• Falls back to mock per-provider when that provider's API key is unset.\n\nNo BYO-key — three keys would be confusing. Use the individual chat agents for BYO. 25 credits per call (3× chat pricing + overhead).",
    category: "LLM",
    tags: ["compare", "claude", "gpt", "gemini", "evaluation", "race", "wrapper"],
    iconEmoji: "🥊",
    accentHex: "#dc2626",
    screenshots: ["Three responses", "Latency comparison", "Mixed mock + real"],
    pricePerCall: 25,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", maxLength: 50000 },
        providers: {
          type: "array",
          items: { type: "string", enum: ["claude", "gpt", "gemini"] },
          default: ["claude", "gpt", "gemini"],
        },
        models: {
          type: "object",
          properties: {
            claude: { type: "string" },
            gpt: { type: "string" },
            gemini: { type: "string" },
          },
        },
        systemPrompt: { type: "string" },
        maxTokens: { type: "integer", minimum: 1, maximum: 4096, default: 512 },
      },
    },
    outputSchema: {
      type: "object",
      required: ["prompt", "answers"],
      properties: {
        prompt: { type: "string" },
        answers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              provider: { type: "string", enum: ["claude", "gpt", "gemini"] },
              text: { type: "string" },
              model: { type: "string" },
              mode: { type: "string", enum: ["managed", "mock"] },
              inputTokens: { type: "integer" },
              outputTokens: { type: "integer" },
              durationMs: { type: "integer" },
              ok: { type: "boolean" },
              error: { type: ["string", "null"] },
            },
          },
        },
        fastest: { type: ["string", "null"], enum: ["claude", "gpt", "gemini", null] },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      prompt: "Explain orqis in one sentence.",
      maxTokens: 128,
    },
    exampleResponse: {
      prompt: "Explain orqis in one sentence.",
      answers: [
        { provider: "claude", text: "orqis is a marketplace for specialist AI agents...", model: "claude-haiku-4-5-20251001", mode: "managed", inputTokens: 8, outputTokens: 24, durationMs: 412, ok: true, error: null },
        { provider: "gpt", text: "orqis is a credit-based marketplace where humans and AI agents discover and invoke specialist APIs.", model: "gpt-4o-mini", mode: "managed", inputTokens: 8, outputTokens: 22, durationMs: 380, ok: true, error: null },
        { provider: "gemini", text: "orqis is a dual-audience API marketplace — browsable by humans, callable by AI agents.", model: "gemini-2.5-flash", mode: "managed", inputTokens: 8, outputTokens: 21, durationMs: 318, ok: true, error: null },
      ],
      fastest: "gemini",
      durationMs: 420,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/compare-models/run",
  },

  // =====================================================================
  // Sprint 18.5 — site-crawl: multi-page Playwright crawler.
  // Reuses page-shot / scrape-render's primitives in a BFS loop.
  // Sync for now (kept under the 30s proxy timeout via maxPages cap);
  // async variant for larger crawls is post-MVP.
  // =====================================================================
  {
    slug: "site-crawl",
    name: "site-crawl",
    tagline: "Walk a site, return HTML + visible text per page. BFS, same-origin by default.",
    description:
      "Hand it a starting URL; get back every reachable page (up to maxPages) with rendered HTML, visible text, status code, and link count per page. Single browser, sequential navigation, polite per-page delay.",
    longDescription:
      "site-crawl is the multi-page companion to scrape-render. Single-page scraping (scrape-render, scrape-clean) is fine when you know the URL; site-crawl is what you reach for when you want to ingest *a whole section of a site* for RAG, archival, or competitive research.\n\n**Algorithm:**\n• BFS from `startUrl`. Same browser, sequential nav (no per-page launch overhead).\n• Same-origin filtering by default (`allowExternal: true` to follow outbound links).\n• Strip fragments (`#section`) and skip non-HTML extensions (.pdf, .png, .mp4, .zip, …).\n• Per-host politeness delay between pages (default 400 ms) — don't hammer the target.\n• Each page returns `{ url, finalUrl, status, title, html, text, linkCount, depth, ok, error }`. A single page failing doesn't fail the whole call.\n\n**Limits (sync, MVP):**\n• `maxPages`: default 5, hard cap 15. Bigger crawls need an async variant.\n• `maxDepth`: default 2, hard cap 5.\n• HTML truncated at 2 MB per page; text at 80k chars.\n• 15s navigation timeout per page.\n\n**Use it for:** RAG ingest of a docs site, link audit, content-snapshot for compliance, competitor-site enumeration, broken-link surveys.\n\n**Don't use it for:** entire-domain crawls (we cap at 15 pages — use a real crawler like Crawlee for that), images / file downloads (we strip those from the queue), authenticated pages (no cookie injection yet).",
    category: "Web",
    tags: ["crawler", "scraper", "playwright", "bfs", "rag", "utility"],
    iconEmoji: "🕸️",
    accentHex: "#c026d3",
    screenshots: ["BFS queue", "Per-page rollup", "Same-origin filtering"],
    pricePerCall: 10,
    isAsync: false,
    inputSchema: {
      type: "object",
      required: ["startUrl"],
      properties: {
        startUrl: { type: "string", format: "uri" },
        maxPages: { type: "integer", minimum: 1, maximum: 15, default: 5 },
        maxDepth: { type: "integer", minimum: 0, maximum: 5, default: 2 },
        allowExternal: { type: "boolean", default: false, description: "Follow links to other origins." },
        device: { type: "string", enum: ["desktop", "mobile"], default: "desktop" },
        waitUntil: { type: "string", enum: ["load", "domcontentloaded", "networkidle"], default: "domcontentloaded" },
        extractText: { type: "boolean", default: true },
        perPageDelayMs: { type: "integer", minimum: 0, maximum: 5000, default: 400 },
      },
    },
    outputSchema: {
      type: "object",
      required: ["startUrl", "origin", "visited", "pages"],
      properties: {
        startUrl: { type: "string", format: "uri" },
        origin: { type: "string" },
        visited: { type: "integer" },
        skippedDuplicates: { type: "integer" },
        skippedExternal: { type: "integer" },
        skippedNonHtml: { type: "integer" },
        hitMaxPages: { type: "boolean" },
        hitMaxDepth: { type: "boolean" },
        pages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              url: { type: "string", format: "uri" },
              finalUrl: { type: "string", format: "uri" },
              depth: { type: "integer" },
              status: { type: "integer" },
              title: { type: "string" },
              html: { type: "string" },
              text: { type: ["string", "null"] },
              linkCount: { type: "integer" },
              durationMs: { type: "integer" },
              ok: { type: "boolean" },
              error: { type: ["string", "null"] },
            },
          },
        },
        durationMs: { type: "integer" },
      },
    },
    exampleRequest: {
      startUrl: "https://orqis.xyz",
      maxPages: 3,
      maxDepth: 1,
    },
    exampleResponse: {
      startUrl: "https://orqis.xyz/",
      origin: "https://orqis.xyz",
      visited: 3,
      skippedDuplicates: 12,
      skippedExternal: 8,
      skippedNonHtml: 2,
      hitMaxPages: true,
      hitMaxDepth: false,
      pages: [
        {
          url: "https://orqis.xyz/",
          finalUrl: "https://orqis.xyz/",
          depth: 0,
          status: 200,
          title: "orqis — The marketplace for specialist AI agents",
          html: "<!doctype html><html>…</html>",
          text: "orqis — the marketplace for specialist AI agents…",
          linkCount: 47,
          durationMs: 1_840,
          ok: true,
          error: null,
        },
        {
          url: "https://orqis.xyz/browse",
          finalUrl: "https://orqis.xyz/browse",
          depth: 1,
          status: 200,
          title: "Browse — orqis",
          html: "<!doctype html>…",
          text: "Browse specialist AI agents…",
          linkCount: 38,
          durationMs: 1_120,
          ok: true,
          error: null,
        },
        {
          url: "https://orqis.xyz/docs",
          finalUrl: "https://orqis.xyz/docs",
          depth: 1,
          status: 200,
          title: "API reference — orqis",
          html: "<!doctype html>…",
          text: "Public REST API…",
          linkCount: 12,
          durationMs: 980,
          ok: true,
          error: null,
        },
      ],
      durationMs: 4_420,
    },
    ratingAverage: 0,
    ratingCount: 0,
    invocationCount: 0,
    endpointUrl: "http://localhost:4000/v1/agents/site-crawl/run",
  },
];

export const SEED_CATEGORIES = Array.from(new Set(SEED_AGENTS.map((a) => a.category))).sort();
