import type { ReactNode } from "react";
import { PathyLogo } from "@/components/oge/logo";

export function PageHeader({
  crumb,
  title,
  lead,
  right,
}: {
  crumb?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="mb-10">
      <div className="pf-section-eyebrow mb-6">
        <span className="pf-section-eyebrow__label inline-flex items-center gap-3">
          <PathyLogo size="sm" />
          {crumb ? <span>/ {crumb}</span> : null}
        </span>
      </div>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="pf-h1">{title}</h1>
          <span
            aria-hidden
            className="block mt-4"
            style={{ width: 56, height: 2, background: "var(--pf-cinnabar)" }}
          />
          {lead ? <p className="pf-lead mt-6">{lead}</p> : null}
        </div>
        {right}
      </div>
    </header>
  );
}
