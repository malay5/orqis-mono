import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listApiKeys, mintApiKey, type ApiKeyScope } from "@/lib/api-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SCOPES: ApiKeyScope[] = ["read", "invoke"];

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  return NextResponse.json({ keys: await listApiKeys() });
}

export async function POST(req: Request) {
  // Session-only by design — a key that can mint keys is a privilege
  // escalation path. The backend enforces this too.
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "label is required." }, { status: 400 });

  const scopes = Array.isArray(body.scopes)
    ? (body.scopes as unknown[]).filter((s): s is ApiKeyScope =>
        typeof s === "string" && ALLOWED_SCOPES.includes(s as ApiKeyScope)
      )
    : ALLOWED_SCOPES;
  if (scopes.length === 0) {
    return NextResponse.json(
      { error: `scopes must include at least one of: ${ALLOWED_SCOPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({ key: await mintApiKey({ label, scopes }) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to mint key." },
      { status: 500 }
    );
  }
}
