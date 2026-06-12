import type { ReactNode } from "react";

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
      {crumb ? <div className="pf-crumb mb-6">{crumb}</div> : null}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="pf-h1">{title}</h1>
          {lead ? <p className="pf-lead">{lead}</p> : null}
        </div>
        {right}
      </div>
    </header>
  );
}
