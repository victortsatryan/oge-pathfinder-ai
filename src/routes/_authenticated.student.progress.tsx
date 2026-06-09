import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/student/progress")({
  component: () => (
    <div className="text-sm text-muted-foreground">
      Подробная сводка прогресса доступна в{" "}
      <Button asChild variant="link" className="px-1">
        <Link to="/profile">профиле</Link>
      </Button>
      .
    </div>
  ),
});
