import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  delay?: number;
};

export function Reveal({ children, delay = 0 }: RevealProps) {
  return (
    <div
      className="reveal-on-load"
      style={{ animationDelay: `${delay}s` }}
      data-motion="reveal"
    >
      {children}
    </div>
  );
}
