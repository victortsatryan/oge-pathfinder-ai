import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {children ?? "Раздел в разработке. Скоро здесь появится полноценный функционал."}
      </CardContent>
    </Card>
  );
}
