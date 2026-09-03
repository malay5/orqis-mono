import { SiteShell } from "@/components/SiteShell";
import { CategoryMarquee } from "@/components/sections/CategoryMarquee";
import { AgentApi } from "@/components/sections/AgentApi";
import { Faq } from "@/components/sections/Faq";
import { HomeDefaultHero } from "./HomeDefaultHero";
import { FeaturedAgents } from "./FeaturedAgents";
import { getSession } from "@/lib/session";
import { getAgents } from "@/lib/agents";
import { SiteJsonLd } from "@/components/seo/JsonLd";

/** The marketplace home page. */
export async function HomeDefault() {
  const [session, { agents }] = await Promise.all([getSession(), getAgents()]);
  const featured = agents.slice(0, 6);

  return (
    <SiteShell>
      <SiteJsonLd />
      <HomeDefaultHero signedIn={!!session?.user?.id} />
      <CategoryMarquee />
      <FeaturedAgents agents={featured} />
      <AgentApi />
      <Faq />
    </SiteShell>
  );
}
