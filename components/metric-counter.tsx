"use client";

import { useEffect, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

type MetricCounterProps = {
  value: number;
  suffix?: string;
  label: string;
  detail: string;
};

export function MetricCounter({ value, suffix = "", label, detail }: MetricCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const renderedValue = reduceMotion ? value : display;

  useEffect(() => {
    if (!inView) {
      return;
    }

    if (reduceMotion) {
      return;
    }

    let frame = 0;
    const totalFrames = 34;

    const tick = () => {
      frame += 1;
      const progress = Math.min(frame / totalFrames, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [inView, reduceMotion, value]);

  return (
    <div ref={ref} className="bg-[var(--surface)] p-6" data-testid="metric">
      <p className="font-display text-4xl text-[var(--ink)]">
        {renderedValue.toLocaleString()}
        {suffix}
      </p>
      <h2 className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-dark)]">{label}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p>
    </div>
  );
}
