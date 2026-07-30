"use client";

import Image from "next/image";
import { ArrowDown, Download, GitBranch, Mail, Network } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { ButtonLink } from "@/components/button-link";
import { getCurrentExperience, profile } from "@/data/profile";
import { site } from "@/data/site";

const item = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 }
};

export function Hero() {
  const reduceMotion = useReducedMotion();
  const currentExperience = getCurrentExperience();

  return (
    <section className="relative border-b border-[var(--line)] bg-[var(--surface)]">
      <div className="mx-auto grid min-h-[calc(100svh-72px)] w-full max-w-6xl content-center gap-10 px-5 pb-16 pt-28 md:min-h-[720px] md:grid-cols-[1fr_220px] md:items-center lg:px-8">
        <motion.div
          initial={reduceMotion ? "visible" : "hidden"}
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.075
              }
            }
          }}
          className="max-w-4xl"
        >
          <motion.p variants={item} className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">
            {currentExperience.role} and AI Systems Architect
          </motion.p>
          <motion.h1 variants={item} className="break-anywhere mt-5 font-display text-5xl leading-[1.02] text-balance text-[var(--ink)] sm:text-6xl md:text-7xl">
            {site.name}
          </motion.h1>
          <motion.p variants={item} className="mt-6 max-w-3xl text-xl leading-9 text-pretty text-[var(--muted)]">
            {site.description}
          </motion.p>
          <motion.p variants={item} className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)]">
            {profile.summary}
          </motion.p>
          <motion.div variants={item} className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={site.emailHref} variant="primary" icon={<Mail size={16} />}>Contact</ButtonLink>
            <ButtonLink href={site.resume} icon={<Download size={16} />}>Resume</ButtonLink>
            <ButtonLink href={site.github} icon={<GitBranch size={16} />}>GitHub</ButtonLink>
            <ButtonLink href={site.linkedin} icon={<Network size={16} />}>LinkedIn</ButtonLink>
          </motion.div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.45 }}
          className="flex items-center gap-4 md:block"
        >
          <Image
            src={site.avatar}
            alt={site.name}
            width={176}
            height={176}
            priority
            unoptimized
            className="h-28 w-28 rounded-lg border border-[var(--line)] object-cover md:h-44 md:w-44"
          />
          <div className="max-w-[16rem] md:mt-5">
            <h2 className="text-sm font-semibold text-[var(--ink)]">{currentExperience.company}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{currentExperience.summary}</p>
          </div>
        </motion.div>
      </div>
      <a
        href="#projects"
        className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--ink)] md:inline-flex"
      >
        Selected work
        <ArrowDown size={16} />
      </a>
    </section>
  );
}
