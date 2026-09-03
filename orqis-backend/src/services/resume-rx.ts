import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * resume-rx — Sprint 9 in-house sync agent.
 * Senior-engineer-grade resume review against any role.
 *
 * Two modes (picked from ANTHROPIC_API_KEY):
 *   - unset / "mock"  → returns a hand-written canned evaluation (smoke-test)
 *   - real key        → claude-sonnet-4-6 with prompt-cached system prompt
 *                       + structured output via client.messages.parse()
 */

export type ResumeRxInput = {
  resume: string; // already-extracted plain text by the time we get here
  jobDescription?: string; // resolved (URL was fetched + cleaned by the route)
  targetRole?: string;
  targetSeniority?:
    | "intern"
    | "junior"
    | "mid"
    | "senior"
    | "staff"
    | "principal"
    | "manager"
    | "director";
  industryHint?: string;
  evaluationMode?: "ats" | "human" | "both";
  rubricFocus?: string[];
  redLines?: string[];
  tone?: "blunt" | "constructive" | "encouraging";
  outputFormat?: "json" | "markdown" | "both";
  includeRewriteSuggestions?: boolean;
  includeKeywordGaps?: boolean;
  includeAtsBreakdown?: boolean;
  includeRedFlags?: boolean;
  redactPii?: boolean;
  language?: string;
};

// Zod schema mirrors the seed entry's outputSchema — keep in sync.
const ResumeRxOutputSchema = z.object({
  overallScore: z.number().min(0).max(100),
  recommendation: z.enum(["strong-hire", "hire", "no-hire", "strong-no-hire"]),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  ats: z
    .object({
      score: z.number().min(0).max(100),
      compatible: z.boolean(),
      issues: z.array(
        z.object({
          severity: z.enum(["low", "medium", "high"]),
          area: z.enum([
            "format",
            "parseability",
            "sections",
            "keywords",
            "length",
            "contact",
          ]),
          message: z.string(),
        })
      ),
    })
    .nullable(),
  sectionScores: z.record(z.string(), z.number().min(0).max(100)),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  redFlags: z.array(z.string()),
  keywordGaps: z.array(
    z.object({
      keyword: z.string(),
      importance: z.enum(["nice-to-have", "preferred", "required"]),
      presentInResume: z.boolean(),
    })
  ),
  rewriteSuggestions: z.array(
    z.object({
      section: z.string(),
      before: z.string(),
      after: z.string(),
      reason: z.string(),
    })
  ),
  nextSteps: z.array(z.string()),
  markdownReport: z.string(),
});

export type ResumeRxResult = z.infer<typeof ResumeRxOutputSchema> & {
  modelUsed: "mock" | "claude-sonnet-4-6";
  cacheReadTokens?: number;
};

// Frozen: any byte change invalidates the prompt cache. Keep volatile content
// (the actual resume + JD) in the user message only.
const SYSTEM_PROMPT_RUBRIC = `You are resume-rx, a senior-engineer-grade resume reviewer.

You have two evaluation lenses:

1. **ATS lens** — simulate a modern Applicant Tracking System. Score keyword coverage against the JD, flag formatting that breaks parsers (text in images, two-column layouts, exotic fonts, dates as images, missing standard section headers).
2. **Human lens** — simulate a hiring manager / staff engineer reading the resume cold. Call out:
   - Bullets that describe activity instead of impact ("improved performance" with no number).
   - Weak action verbs ("worked on", "helped with", "involved in").
   - Missing context for scope ("led a migration" — of what? how many services? what was the result?).
   - Title inflation vs measurable signals.
   - Tenure shape: very short stints, gaps, mismatches with claimed seniority.
   - Padded experience: long bullet lists with low signal density.

When the user picks evaluationMode "both", weight the final score 30% ATS + 70% human.

When tone="blunt", phrase weaknesses for the candidate themselves — no euphemisms.
When tone="constructive", lead each weakness with what's good about the underlying intent.
When tone="encouraging", focus on the path forward; soft-pedal the deltas.

Recommendation mapping:
  90-100 → strong-hire
  70-89  → hire
  40-69  → no-hire
  0-39   → strong-no-hire

Confidence: 0.95+ when the resume is detailed and the JD is well-defined; 0.6-0.8 when one input is sparse; below 0.5 when both are sparse and you're guessing.

Rewrite suggestions: for each, quote the EXACT before bullet from the resume, then write a concrete after that demonstrates the improvement (numbers, scope, ownership). Reason field explains the rule applied.

Section scoring keys: experience, skills, education, leadership, communication, achievements, technical-depth, ownership, career-progression. Only emit keys that the user requested via rubricFocus, or all of them if rubricFocus is empty.

Keyword gaps: only when a JD is provided. Pull keywords from the JD, mark importance based on whether the JD presents them as required vs preferred vs nice-to-have, and flag presentInResume based on whether you can find the literal token (or a close synonym) in the resume.

ATS issues: only when includeAtsBreakdown is true. Severity reflects how likely an ATS is to fail to parse the section.

Red flags: only when includeRedFlags is true. These are specifically things hiring managers worry about. Tenure issues, gaps, title inflation, vague claims of leadership without scope, etc.

Output the markdownReport as a publishable review document — usable as-is to share with the candidate. Lead with the recommendation + summary. Then strengths, weaknesses, ATS issues, keyword gaps, rewrite suggestions, next steps. Use real markdown headings and bullets. Keep it under ~800 words.

Return STRUCTURED JSON only — your output will be schema-validated. Do not include any commentary outside the schema fields.`;

export type ResumeRxRunMode = "real" | "mock";

export function detectMode(): ResumeRxRunMode {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "mock") return "mock";
  return "real";
}

export async function runResumeRx(input: ResumeRxInput): Promise<ResumeRxResult> {
  if (detectMode() === "mock") return runMock(input);
  return runReal(input);
}

// -------------------- mock --------------------

function runMock(input: ResumeRxInput): ResumeRxResult {
  return {
    overallScore: 58,
    recommendation: "no-hire",
    confidence: 0.65,
    summary:
      "Mock-mode evaluation. Set ANTHROPIC_API_KEY to a real key for an actual review. Bullets are activity-focused; needs measurable impact + scope details. Three concrete rewrites would lift this 15+ points.",
    ats: input.includeAtsBreakdown
      ? {
          score: 78,
          compatible: true,
          issues: [
            {
              severity: "low",
              area: "keywords",
              message: "Mock: missing some JD keywords (would be specific in real mode).",
            },
          ],
        }
      : null,
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
      "Skills list aligns with the apparent target stack.",
      "Career arc shows progression.",
    ],
    weaknesses: [
      "Bullets describe activity, not measurable impact.",
      "No mention of mentorship or cross-team work.",
      "Specific JD requirements may not be addressed (mock mode can't compare).",
    ],
    redFlags: input.includeRedFlags
      ? ["Mock: would surface tenure/gap concerns in real mode."]
      : [],
    keywordGaps:
      input.includeKeywordGaps && input.jobDescription
        ? [
            {
              keyword: "(mock keyword)",
              importance: "required" as const,
              presentInResume: false,
            },
          ]
        : [],
    rewriteSuggestions: input.includeRewriteSuggestions
      ? [
          {
            section: "Experience",
            before: "Improved performance of the API",
            after:
              "Cut p99 API latency from 240ms to 90ms by introducing connection pooling and read replicas; sustained gains across 4 quarterly load tests.",
            reason:
              "Replaces vague claim with measurable impact + sustained scope — what staff-level reviewers look for.",
          },
        ]
      : [],
    nextSteps: [
      "Rewrite the top 3 bullets with measurable impact.",
      "Add a Mentorship line: who, how many, what they shipped.",
      "Surface any message-queue / scaling experience explicitly.",
    ],
    markdownReport: `# Resume Evaluation (Mock)\n\nThis is a mock-mode response so the pipeline can be smoke-tested without API costs. Set \`ANTHROPIC_API_KEY\` to a real key to enable the real evaluation.\n\n## Recommendation: no-hire\n\nBullets describe activity, not impact. Three concrete rewrites would lift this evaluation 15+ points.\n`,
    modelUsed: "mock",
  };
}

// -------------------- real --------------------

function buildUserMessage(input: ResumeRxInput): string {
  const parts: string[] = [];
  parts.push(`# Configuration`);
  parts.push(`evaluationMode: ${input.evaluationMode ?? "both"}`);
  parts.push(`tone: ${input.tone ?? "constructive"}`);
  if (input.targetSeniority) parts.push(`targetSeniority: ${input.targetSeniority}`);
  if (input.targetRole) parts.push(`targetRole: ${input.targetRole}`);
  if (input.industryHint) parts.push(`industryHint: ${input.industryHint}`);
  if (input.rubricFocus?.length)
    parts.push(`rubricFocus: ${input.rubricFocus.join(", ")}`);
  if (input.redLines?.length) parts.push(`redLines: ${input.redLines.join(" | ")}`);
  parts.push(`includeRewriteSuggestions: ${input.includeRewriteSuggestions !== false}`);
  parts.push(`includeKeywordGaps: ${input.includeKeywordGaps !== false}`);
  parts.push(`includeAtsBreakdown: ${input.includeAtsBreakdown !== false}`);
  parts.push(`includeRedFlags: ${input.includeRedFlags !== false}`);
  parts.push(`language: ${input.language ?? "en"}`);
  parts.push(``);
  parts.push(`# Resume`);
  parts.push(input.resume);
  if (input.jobDescription) {
    parts.push(``);
    parts.push(`# Job Description`);
    parts.push(input.jobDescription);
  }
  return parts.join("\n");
}

async function runReal(input: ResumeRxInput): Promise<ResumeRxResult> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-sonnet-4-6",
    max_tokens: 16_000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: zodOutputFormat(ResumeRxOutputSchema),
    },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT_RUBRIC,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(
      `resume-rx: model response did not validate against the schema (stop_reason=${response.stop_reason}).`
    );
  }
  return {
    ...parsed,
    modelUsed: "claude-sonnet-4-6",
    cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
  };
}
