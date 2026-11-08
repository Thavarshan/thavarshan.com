import { navigation, site } from "@/features/profile/site";
import { SiteNavClient } from "./site-nav-client";

/** Keep the full validated profile on the server; serialize only links used by the browser. */
export function SiteNav() {
  return <SiteNavClient navigation={navigation} site={{ github: site.github, emailHref: site.emailHref, resume: site.resume }} />;
}
