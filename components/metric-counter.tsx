type MetricCounterProps = {
  value: number;
  suffix?: string;
  label: string;
  detail: string;
};

export function MetricCounter({ value, suffix = "", label, detail }: MetricCounterProps) {
  return (
    <div className="bg-[var(--surface)] p-6" data-testid="metric">
      <p className="font-display text-4xl text-[var(--ink)]">
        {value.toLocaleString()}
        {suffix}
      </p>
      <h2 className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-dark)]">{label}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p>
    </div>
  );
}
