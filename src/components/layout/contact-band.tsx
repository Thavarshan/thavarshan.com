import Link from "next/link";
import { ArrowUpRight, Mail, Network } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { conversationHref, conversionProjects } from "@/features/profile/conversion";
import { profile } from "@/features/profile/profile";
import { site } from "@/features/profile/site";

export function ContactBand() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="border-y border-[var(--line)] bg-[var(--ink)] text-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-16 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f0c37b]">Work with me</p>
        <h2 id="contact-title" className="mt-4 max-w-3xl font-display text-[clamp(2rem,9vw,3rem)] leading-tight text-balance md:text-5xl">
          Full-stack engineering, technical leadership and generative AI.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-8 text-white/72">
          Explore my experience and work, then tell me about the role or problem you have in mind.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section id="hiring" aria-labelledby="hiring-title" className="rounded-lg border border-white/20 p-5 sm:p-6">
            <h3 id="hiring-title" className="text-xl font-semibold">
              Hiring for technical leadership, full-stack or GenAI engineering?
            </h3>
            <p className="mt-3 text-sm leading-7 text-white/72">{profile.identity.headline}</p>
            {profile.identity.specialtyLine ? <p className="mt-3 text-sm font-medium text-[#f0c37b]">{profile.identity.specialtyLine}</p> : null}
            <p className="mt-3 text-sm leading-7 text-white/72">
              Open to Technical Lead, Senior Full Stack Engineer and Generative AI Engineer roles. Remote work preferred; open to relocation.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm">
              <Link href="/#experience" className="underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
                Career experience
              </Link>
              <Link href="/cv" className="underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
                Full CV
              </Link>
            </div>
            <div className="mobile-stack-actions mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href={conversationHref("hiring")} variant="onDarkPrimary" icon={<Mail size={16} />} eventName="Hire">
                Discuss a role
              </ButtonLink>
              <ButtonLink href={site.resume} variant="onDarkGhost" icon={<ArrowUpRight size={16} />} eventName="Resume Download">
                View resume
              </ButtonLink>
              <ButtonLink href={site.github} variant="onDarkGhost" eventName="GitHub Visit">
                GitHub profile
              </ButtonLink>
            </div>
          </section>
          <section id="consulting" aria-labelledby="consulting-title" className="rounded-lg border border-white/20 p-5 sm:p-6">
            <h3 id="consulting-title" className="text-xl font-semibold">
              Have a project to discuss?
            </h3>
            <p className="mt-3 text-sm leading-7 text-white/72">
              Explore product engineering, AI workflows, enterprise integrations and platform modernization, alongside maintained PHP/Laravel libraries.
            </p>
            <ul className="mt-4 space-y-4 text-sm leading-7">
              {conversionProjects.map((project) => (
                <li key={project.repository}>
                  <Link
                    href={`/projects/${project.repository}`}
                    className="font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                  >
                    {project.name}
                  </Link>
                  <p className="text-white/72">{project.description}</p>
                </li>
              ))}
              <li>
                <Link
                  href="/insights/modernizing-legacy-platforms-during-delivery"
                  className="underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  Platform modernization: decisions and trade-offs
                </Link>
              </li>
            </ul>
            <div className="mobile-stack-actions mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href={conversationHref("consulting")} variant="onDarkPrimary" icon={<Mail size={16} />} eventName="Consulting">
                Discuss a project
              </ButtonLink>
            </div>
          </section>
        </div>
        <div className="mobile-stack-actions mt-8 flex flex-col gap-3 border-t border-white/20 pt-6 sm:flex-row sm:flex-wrap">
          <ButtonLink href={site.emailHref} variant="onDarkGhost" icon={<Mail size={16} />} eventName="Contact">
            Start a conversation
          </ButtonLink>
          <ButtonLink href={site.linkedin} variant="onDarkGhost" icon={<Network size={16} />} eventName="LinkedIn Visit">
            Connect on LinkedIn
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
