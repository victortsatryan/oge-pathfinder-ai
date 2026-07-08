import type { ReactNode } from "react";

/**
 * Editorial section header:
 *   ┌───────────────────────────────────────────────┐
 *   │ SECTION / SUB                            ▪    │  hairline
 *   └───────────────────────────────────────────────┘
 * mark can be ink | mustard (default) | cinnabar | ultra | forest.
 */
export function SectionEyebrow({
  section,
  sub,
  mark = "mustard",
  right,
}: {
  section: string;
  sub?: string;
  mark?: "ink" | "mustard" | "cinnabar" | "ultra" | "forest";
  right?: ReactNode;
}) {
  return (
    <div className="pf-section-eyebrow">
      <span className="pf-section-eyebrow__label">
        <b>{section}</b>
        {sub ? <span> / {sub}</span> : null}
      </span>
      <div className="flex items-center gap-3">
        {right}
        <span
          aria-hidden
          className={
            "pf-section-eyebrow__mark" +
            (mark !== "mustard" ? ` pf-section-eyebrow__mark--${mark}` : "")
          }
        />
      </div>
    </div>
  );
}
