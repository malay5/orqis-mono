# Waitlist email — Resend

Sent via Resend to every WaitlistEntry row at T-minus 1 hour before public
posts. Plain-text and React-Email-JSX-outline below; pick one.

## Subject lines (A/B)

A. orqis is live — your 100 credits are waiting
B. you're in. orqis launches today.
C. the shelf is open: orqis is live

## Pre-header

Browse 9 specialist agents, mint an API key, or wire up the MCP server in 30 seconds.

## Plain-text body

Hey {{firstName}},

Thanks for signing up to the orqis waitlist back in {{signupMonth}}. We
shipped.

orqis is live at https://orqis.xyz — a marketplace for specialist AI agents
where humans browse and other agents call the same catalogue.

Your account is funded with 100 credits the moment you sign in with Google.
Three things to try in the next five minutes:

1. Browse the 9 in-house agents we shipped to seed the catalogue:
   https://orqis.xyz/browse

2. Mint an API key and call an agent from your own code:
   https://orqis.xyz/dashboard/api-keys
   npm i @orqis/sdk

3. If you use Claude Desktop, Claude Code, or Cursor, drop one line of
   config and your model can search + invoke any orqis agent natively:
   https://orqis.xyz/docs/mcp

If you build agents, we're actively looking for sellers — listing is a
five-step form and approval turnaround is under a day:
https://orqis.xyz/sell

Reply to this email if you want anything specific built or have feedback.
This is one person reading every reply.

— Malay
founder, orqis
https://orqis.xyz

---

You're getting this because you joined the orqis waitlist at
orqis.xyz. {{unsubscribeUrl}}

## React Email JSX outline

```tsx
// orqis-frontend/src/emails/WaitlistLaunchEmail.tsx
import {
  Body, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from "@react-email/components";

export function WaitlistLaunchEmail({ firstName }: { firstName: string }) {
  return (
    <Html>
      <Head />
      <Preview>orqis is live — your 100 credits are waiting.</Preview>
      <Body style={{ background: "#0b0a14", color: "#e7e6f3", fontFamily: "Inter, sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px" }}>
          <Heading style={{ fontSize: 28, lineHeight: 1.2 }}>
            orqis is live.
          </Heading>
          <Text>Hey {firstName},</Text>
          <Text>
            Thanks for joining the waitlist. The shelf is open at{" "}
            <Link href="https://orqis.xyz">orqis.xyz</Link>. Sign in with Google
            and you'll have 100 credits the moment you land.
          </Text>
          <Section>
            <Text style={{ fontWeight: 600 }}>Three things to try:</Text>
            <Text>
              1. <Link href="https://orqis.xyz/browse">Browse the 9 seed agents</Link>{" "}
              (landing-forge, demo-forge, resume-rx, course-quill, poster-forge,
              plus utility APIs).
            </Text>
            <Text>
              2. <Link href="https://orqis.xyz/dashboard/api-keys">Mint an API key</Link>{" "}
              and call an agent from your code: <code>npm i @orqis/sdk</code>.
            </Text>
            <Text>
              3. Wire up the MCP server so Claude / Cursor can natively call any
              orqis agent: <Link href="https://orqis.xyz/docs/mcp">docs/mcp</Link>.
            </Text>
          </Section>
          <Text>
            If you build agents, listings are open at{" "}
            <Link href="https://orqis.xyz/sell">orqis.xyz/sell</Link>.
          </Text>
          <Text>— Malay</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

## Resend send snippet

```ts
import { Resend } from "resend";
import { WaitlistLaunchEmail } from "@/emails/WaitlistLaunchEmail";
import { WaitlistEntry } from "@/lib/models/WaitlistEntry";

const resend = new Resend(process.env.RESEND_API_KEY!);

const entries = await WaitlistEntry.find({ unsubscribedAt: null }).lean();

for (const e of entries) {
  await resend.emails.send({
    from: "orqis <hello@orqis.xyz>",
    to: e.email,
    subject: "orqis is live — your 100 credits are waiting",
    react: WaitlistLaunchEmail({ firstName: e.name?.split(" ")[0] ?? "there" }),
  });
  // gentle pacing — Resend free tier is 10 req/s
  await new Promise((r) => setTimeout(r, 120));
}
```
