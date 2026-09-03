import { ShieldCheck } from "lucide-react";
import { RatingStars } from "./RatingStars";
import type { ReviewView } from "@/lib/reviews";

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function ReviewList({ reviews }: { reviews: ReviewView[] }) {
  if (reviews.length === 0) {
    return (
      <div className="surface-elev p-7 text-center">
        <p className="text-fg-muted text-sm">
          No reviews yet — be the first to share your experience.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li key={r.id} className="surface-elev p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {r.authorImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.authorImage} alt="" className="w-8 h-8 rounded-full shrink-0" />
              ) : (
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] text-white text-xs font-semibold shrink-0">
                  {r.authorName.trim().charAt(0).toUpperCase() || "?"}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg truncate">
                  {r.authorName}
                  {r.isMine && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-violet font-mono">
                      You
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-fg-subtle">{fmt.format(new Date(r.createdAt))}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <RatingStars value={r.rating} size={14} />
              {r.verifiedUse && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-cyan"
                  title="This reviewer has actually invoked the agent"
                >
                  <ShieldCheck className="w-3 h-3" />
                  verified
                </span>
              )}
            </div>
          </div>

          {r.title && <p className="mt-3 text-[15px] font-medium text-fg">{r.title}</p>}
          {r.body && (
            <p className="mt-1 text-[14.5px] text-fg-muted leading-relaxed whitespace-pre-wrap">
              {r.body}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
