import { profile } from "@/data/profile";

export const site = {
  name: profile.identity.name,
  shortName: "Jerome T.",
  title: `${profile.identity.name} | Technical Lead and AI Systems Architect`,
  description: "Technical Lead for AI workflows, scalable platforms, cloud architecture, and open-source developer tools.",
  url: profile.identity.website,
  locale: "en",
  location: profile.identity.location,
  email: profile.identity.email,
  emailHref: `mailto:${profile.identity.email}`,
  github: profile.identity.github,
  linkedin: profile.identity.linkedin,
  resume: "/docs/Jerome-Resume.pdf",
  avatar: profile.identity.avatar
} as const;

export const navigation = [
  { label: "Work", href: "/#projects" },
  { label: "Lead", href: "/#leadership" },
  { label: "Insights", href: "/insights" },
  { label: "Career", href: "/#experience" },
  { label: "Expertise", href: "/#expertise" },
  { label: "Contact", href: "/#contact" }
] as const;
