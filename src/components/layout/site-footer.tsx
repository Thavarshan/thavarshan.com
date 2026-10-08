import Link from "next/link";
import { site } from "@/features/profile/site";

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl justify-center px-5 pb-10 pt-6 text-center text-sm text-[var(--muted)] lg:px-8">
      {/* JSX whitespace is significant in the next element: reflowing it changes the rendered HTML. */}
      {/* prettier-ignore */}
      <p>
        © {new Date().getFullYear()} {site.name}. Colombo, Sri Lanka. <Link className="underline decoration-[var(--line)] underline-offset-4 hover:text-[var(--ink)]" href="/cv">CV</Link> · <Link className="underline decoration-[var(--line)] underline-offset-4 hover:text-[var(--ink)]" href="/tools">Tools</Link> · <Link className="underline decoration-[var(--line)] underline-offset-4 hover:text-[var(--ink)]" href="/privacy">Privacy</Link>
      </p>
    </footer>
  );
}
