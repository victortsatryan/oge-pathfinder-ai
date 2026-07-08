import type { ReactNode } from "react";
import { SectionEyebrow } from "@/components/oge/section-eyebrow";
import { PathyLogo } from "@/components/oge/logo";

export function StubPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  // Highlight the last vowel-friendly char of the title in mustard for a subtle accent.
  const chars = Array.from(title);
  const head = chars.slice(0, -1).join("");
  const tail = chars.slice(-1).join("");

  return (
    <article className="pf-reader-wide pf-rise">
      <div className="pf-section-eyebrow">
        <span className="pf-section-eyebrow__label inline-flex items-center gap-3">
          <PathyLogo size="sm" />
          <span>/ раздел в разработке</span>
        </span>
      </div>

      <header className="mb-12">
        <p className="pf-eyebrow mb-4">черновик секции</p>
        <h1 className="pf-h1" style={{ maxWidth: "18ch" }}>
          {head}
          <span style={{ color: "var(--pf-mustard)" }}>{tail}</span>
        </h1>
        <span
          aria-hidden
          className="block mt-4"
          style={{ width: 56, height: 2, background: "var(--pf-cinnabar)" }}
        />
        <p className="pf-lead mt-6">{description}</p>
      </header>

      <SectionEyebrow section="Статус" mark="mustard" />
      <p className="text-[15px] leading-relaxed mt-4" style={{ color: "var(--pf-ink)", maxWidth: "56ch" }}>
        {children ??
          "Раздел проектируется. Скоро здесь появится содержание — навигация по знаниям, задания и материалы этого блока."}
      </p>
    </article>
  );
}
