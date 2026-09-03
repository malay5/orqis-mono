"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label } from "@/components/ui/Field";
import { RatingPicker } from "./RatingStars";

export function ReviewForm({
  slug,
  initial,
}: {
  slug: string;
  initial?: { rating: number; title: string; body: string };
}) {
  const router = useRouter();
  const { status } = useSession();
  const [rating, setRating] = useState<number>(initial?.rating ?? 0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // No loading skeleton: the session is seeded from the server in the root
  // layout, so `status` is correct on first paint.
  if (status !== "authenticated") {
    return (
      <div className="surface-elev p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Used this agent? Leave a review.</h3>
          <p className="mt-1 text-sm text-fg-muted">Sign in to share your experience.</p>
        </div>
        <Link
          href={`/signin?callbackUrl=/agents/${slug}`}
          className="inline-flex items-center justify-center h-11 px-5 rounded-full font-medium bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] text-white whitespace-nowrap"
        >
          Sign in to review
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (rating < 1 || rating > 5) {
      setError("Pick a rating from 1 to 5.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/agents/${slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, title: title.trim(), body: body.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed (${res.status})`);
      }
      setSuccess(true);
      router.refresh(); // re-fetch the server component so the new review appears
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="surface-elev p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-tight">
          {initial ? "Update your review" : "Leave a review"}
        </h3>
        <p className="mt-1 text-sm text-fg-muted">
          One review per account. Resubmitting overwrites your previous one.
        </p>
      </div>

      <div>
        <Label htmlFor="r-rating" required>
          Rating
        </Label>
        <RatingPicker value={rating} onChange={setRating} disabled={submitting} />
      </div>

      <div>
        <Label htmlFor="r-title">Title (optional)</Label>
        <Input
          id="r-title"
          name="title"
          type="text"
          maxLength={120}
          placeholder="Saved me an entire afternoon"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div>
        <Label htmlFor="r-body">What was your experience?</Label>
        <Textarea
          id="r-body"
          name="body"
          maxLength={4000}
          placeholder="What worked, what didn't, what you'd use it for again…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={submitting}
        />
      </div>

      {error && (
        <p className="text-sm text-pink" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-cyan inline-flex items-center gap-1.5" role="status">
          <CheckCircle2 className="w-4 h-4" />
          Saved. Thanks!
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : initial ? (
            "Update review"
          ) : (
            "Submit review"
          )}
        </Button>
      </div>
    </form>
  );
}
