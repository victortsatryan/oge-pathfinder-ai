import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { PathyLogo } from "@/components/oge/logo";
import { listEntries, type RegistryEntry } from "@/lib/query/registry";

export const Route = createFileRoute("/dev/data-health")({
  component: DataHealth,
});

/**
 * Dev dashboard: shows the last observed shape of every repository call.
 * Populated in-memory as the app runs, so navigate other screens first.
 */
function DataHealth() {
  const [entries, setEntries] = useState<RegistryEntry[]>(() => listEntries());

  useEffect(() => {
    const id = setInterval(() => setEntries(listEntries()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <article className="pf-reader-wide pf-rise">
      <div className="pf-section-eyebrow">
        <span className="pf-section-eyebrow__label inline-flex items-center gap-3">
          <PathyLogo size="sm" />
          <span>/ dev · data-health</span>
        </span>
        <span className="pf-section-eyebrow__label">
          записей: {entries.length}
        </span>
      </div>

      <header className="mb-10">
        <p className="pf-eyebrow mb-4">разработка</p>
        <h1 className="pf-h1" style={{ maxWidth: "18ch" }}>
          Состояние слоя <span style={{ color: "var(--pf-mustard)" }}>данных</span>
        </h1>
        <span
          aria-hidden
          className="block mt-4"
          style={{ width: 56, height: 2, background: "var(--pf-cinnabar)" }}
        />
        <p className="pf-lead mt-6">
          Живой лог валидации репозиториев. Каждая запись — последний вызов
          через parseList / parseOne с указанием размера и найденных проблем.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
          Пока пусто. Откройте другие экраны в соседней вкладке и вернитесь сюда.
        </p>
      ) : (
        <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr
              className="font-mono text-[11px] uppercase tracking-widest"
              style={{ color: "var(--pf-muted)" }}
            >
              <th className="py-3 pr-4">scope</th>
              <th className="py-3 pr-4">kind</th>
              <th className="py-3 pr-4">count</th>
              <th className="py-3 pr-4">keys</th>
              <th className="py-3">issues</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.key} style={{ borderTop: "1px solid var(--pf-line)" }}>
                <td className="py-3 pr-4 font-medium">{e.scope}</td>
                <td className="py-3 pr-4 font-mono text-[12px]" style={{ color: "var(--pf-muted)" }}>
                  {e.kind}
                </td>
                <td
                  className="py-3 pr-4 font-mono text-[13px]"
                  style={{ color: e.ok ? "var(--pf-ink)" : "var(--pf-cinnabar)" }}
                >
                  {e.count ?? "—"}
                </td>
                <td className="py-3 pr-4 font-mono text-[12px]" style={{ color: "var(--pf-muted)" }}>
                  {e.sampleKeys.join(", ") || "—"}
                </td>
                <td
                  className="py-3 font-mono text-[12px]"
                  style={{ color: e.ok ? "var(--pf-muted)" : "var(--pf-cinnabar)" }}
                >
                  {e.issues.join("; ") || "ok"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
