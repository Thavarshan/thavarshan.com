import { ContactBand } from "@/components/contact-band";
import { Hero } from "@/components/hero";
import { InsightCard } from "@/components/insight-card";
import { JsonLd } from "@/components/json-ld";
import { MetricCounter } from "@/components/metric-counter";
import { ProjectCard } from "@/components/project-card";
import { Reveal } from "@/components/reveal";
import { Section } from "@/components/section";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Timeline } from "@/components/timeline";
import { education } from "@/data/education";
import { experience } from "@/data/experience";
import { expertiseGroups } from "@/data/expertise";
import { sameAsProfiles } from "@/data/external-profiles";
import { leadershipCapabilities } from "@/data/leadership";
import { profile } from "@/data/profile";
import { honeymelon } from "@/data/projects";
import { site } from "@/data/site";
import { getApprovedTestimonials } from "@/data/testimonials";
import { getFeaturedInsights } from "@/lib/insights";
import { formatStarTotal } from "@/lib/project-model";
import { getFeaturedProjects } from "@/lib/projects";

export default async function Home() {
  const projects = await getFeaturedProjects();
  const featuredInsights = getFeaturedInsights(3);
  const approvedTestimonials = getApprovedTestimonials();
  const totalStars = projects.reduce((total, project) => total + (project.stats?.stars ?? 0), 0);
  const starMetric = formatStarTotal(totalStars);

  const personId = `${site.url}/#person`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${site.url}/#website`,
        url: site.url,
        name: site.name,
        inLanguage: "en"
      },
      {
        "@type": "ProfilePage",
        "@id": `${site.url}/#profile-page`,
        url: site.url,
        dateModified: profile.modifiedAt,
        mainEntity: { "@id": personId },
        isPartOf: { "@id": `${site.url}/#website` }
      },
      {
        "@type": "Person",
        "@id": personId,
        name: site.name,
        url: site.url,
        image: [
          `${site.url}/images/profile-1x1.jpg`,
          `${site.url}/images/profile-4x3.jpg`,
          `${site.url}/images/profile-16x9.jpg`
        ],
        jobTitle: profile.identity.headline,
        description: profile.summary,
        email: site.email,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Colombo",
          addressCountry: "LK"
        },
        sameAs: sameAsProfiles,
        alumniOf: education.map((item) => ({
          "@type": "CollegeOrUniversity",
          name: item.institution
        })),
        knowsAbout: expertiseGroups.flatMap((group) => group.items)
      }
    ]
  };

  return (
    <main>
      <JsonLd data={jsonLd} />
      <SiteNav />
      <Hero />

      <Section id="credibility" ariaLabel="Professional credibility">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--line)] md:grid-cols-4">
          <MetricCounter value={11} suffix="+" label="Years experience" detail="Technical leadership and product engineering" />
          <MetricCounter value={starMetric.value} suffix={starMetric.suffix} label="Open-source stars" detail="Across the featured GitHub projects" />
          <MetricCounter value={100} suffix="K+" label="Daily users" detail="Platforms built for high-volume operations" />
          <MetricCounter value={4} label="Core strengths" detail="AI, architecture, full stack, and delivery" />
        </div>
      </Section>

      <Section
        id="leadership"
        eyebrow="What I can lead"
        title="Senior engineering work where architecture, product judgment, and team standards meet."
        intro="The site is positioned for focused conversations around work where technical leadership has to create leverage, not only write code."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {leadershipCapabilities.map((capability, index) => (
            <Reveal key={capability.title} delay={index * 0.04}>
              <article className="h-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-[var(--ink)]">{capability.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{capability.summary}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        id="projects"
        eyebrow="Selected Work"
        title="Open-source tools with real adoption, plus product work with commercial intent."
        intro="The portfolio leads with projects that have earned usage and trust. Each card keeps the story practical: what it is, why it exists, and the engineering choices behind it."
      >
        <Reveal>
          <ProjectCard project={honeymelon} variant="product" />
        </Reveal>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {projects.map((project, index) => (
            <Reveal key={project.repository} delay={index * 0.04}>
              <ProjectCard project={project} detailsHref={`/projects/${project.repository}`} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        id="insights"
        eyebrow="Insights"
        title="First-hand notes on AI systems, platform modernization, and developer tools."
        intro="A curated publication for practical engineering judgment: decisions, trade-offs, architecture lessons, and reusable patterns."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {featuredInsights.map((insight, index) => (
            <Reveal key={insight.slug} delay={index * 0.04}>
              <InsightCard insight={insight} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        id="experience"
        eyebrow="Career"
        title="A full-stack path shaped by leadership, architecture, and delivery."
        intro="The timeline keeps the story concise while making the most relevant recent roles easy for hiring leaders to scan."
      >
        <Timeline items={experience} />
      </Section>

      <Section
        id="expertise"
        eyebrow="Expertise"
        title="Depth where it matters: architecture, teams, products, and delivery."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {expertiseGroups.map((group, index) => (
            <Reveal key={group.title} delay={index * 0.04}>
              <div className="h-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-[var(--ink)]">{group.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{group.summary}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-medium text-[var(--cool)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        id="education"
        eyebrow="Education"
        title="Formal engineering education backing practical delivery."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {education.map((item, index) => (
            <Reveal key={item.institution} delay={index * 0.04}>
              <article className="h-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
                <p className="text-sm font-medium text-[var(--accent-dark)]">{item.period}</p>
                <h3 className="mt-3 text-lg font-semibold text-[var(--ink)]">{item.qualification}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.institution}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {approvedTestimonials.length ? (
        <Section
          id="testimonials"
          eyebrow="Testimonials"
          title="Approved words from people who have worked with me."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {approvedTestimonials.map((testimonial) => (
              <blockquote key={`${testimonial.name}-${testimonial.role}`} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
                <p className="text-base leading-8 text-[var(--ink)]">"{testimonial.quote}"</p>
                <footer className="mt-5 text-sm text-[var(--muted)]">
                  {testimonial.name}, {testimonial.role}
                </footer>
              </blockquote>
            ))}
          </div>
        </Section>
      ) : null}

      <ContactBand />

      <SiteFooter />
    </main>
  );
}
