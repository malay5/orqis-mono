import { HomeDefault } from "@/components/home-default/HomeDefault";

/**
 * Home — the public marketplace.
 *
 * Sprint 20: the pre-launch waitlist landing and the `HOME_MODE` switch that
 * selected it are gone. The catalogue is the product; there's nothing left to
 * queue for.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  return <HomeDefault />;
}
