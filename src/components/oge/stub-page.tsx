import type { ReactNode } from "react";
import { SectionEyebrow } from "@/components/oge/section-eyebrow";

export function StubPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <article className="pf-reader-wide pf-rise">
      <div className="pf-section-eyebrow">
        <span className="pf-section-eyebrow__label">
          <b>Раздел</b> / в разработке
        </span>
      </div>

      <header className="mb-12">
        <p className="pf-eyebrow mb-4">черновик секции</p>
        <h1 className="pf-h1" style={{ maxWidth: "18ch" }}>
          {title}
        </h1>
        <p className="pf-lead">{description}</p>
      </header>

      <SectionEyebrow section="Статус" mark="mustard" />
      <p className="text-[15px] leading-relaxed" style={{ color: "var(--pf-ink)", maxWidth: "56ch" }}>
        {children ??
          "Раздел проектируется. Скоро здесь появится содержание — навигация по знаниям, задания и материалы этого блока."}
      </p>
    </article>
  );
}
