import { profile } from "@/features/profile/profile";

export const site = {
  name: profile.identity.name,
  shortName: "Jerome T.",
  title: `${profile.identity.name} | Laravel/PHP Engineer & Technical Lead`,
  description:
    "Laravel/PHP engineer and technical lead building full-stack applications with React, Vue and Inertia, alongside AWS delivery and production AI workflows.",
  url: profile.identity.website,
  locale: "en",
  location: profile.identity.location,
  email: profile.identity.email,
  emailHref: `mailto:${profile.identity.email}`,
  github: profile.identity.github,
  linkedin: profile.identity.linkedin,
  resume: "/docs/Jerome-Resume.pdf",
  avatar: profile.identity.avatar,
  /** First-party, cookie-free event collector (see docs/measurement.md). Empty disables first-party telemetry. */
  metricsUrl: "https://site-metrics.tjthavarshan.workers.dev/collect"
} as const;

export const navigation = [
  { label: "Work", href: "/#projects" },
  { label: "Lead", href: "/#leadership" },
  { label: "Insights", href: "/insights" },
  { label: "Tools", href: "/tools" },
  { label: "Career", href: "/#experience" },
  { label: "Expertise", href: "/#expertise" },
  { label: "Contact", href: "/#contact" }
] as const;
