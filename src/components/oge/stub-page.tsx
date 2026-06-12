import { PageHeader } from "@/components/oge/page-header";
import { ConstructivistIllo } from "@/components/oge/constructivist-illo";

export function StubPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <PageHeader crumb={<><b>Раздел</b> · в разработке</>} title={title} lead={description} />
      <div className="grid gap-8 lg:grid-cols-[1.4fr,1fr] items-start">
        <div className="pf-block">
          <p className="pf-eyebrow mb-4">Статус</p>
          <p className="text-base leading-relaxed">
            {children ?? "Раздел проектируется. Скоро здесь появится навигация по знаниям этого блока."}
          </p>
        </div>
        <ConstructivistIllo variant="minimal" className="w-full" />
      </div>
    </>
  );
}
