import { NextResponse } from "next/server";
import { apiFetch, apiFetchSafe, ApiError } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import type { ReviewView } from "@/lib/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reviews (Sprint 19 — pass-through to orqis-backend). */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const data = await apiFetchSafe<{ count: number; reviews: ReviewView[] }>(
    `/v1/agents/${encodeURIComponent(slug)}/reviews`
  );
  return NextResponse.json(data ?? { count: 0, reviews: [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to leave a review." }, { status: 401 });
  }

  const { slug } = await params;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }

  try {
    const data = await apiFetch<{ review: ReviewView }>(
      `/v1/agents/${encodeURIComponent(slug)}/reviews`,
      { method: "POST", authenticated: true, body }
    );
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Could not save your review." }, { status: 500 });
  }
}
