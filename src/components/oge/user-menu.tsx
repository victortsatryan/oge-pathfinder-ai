import { Link, useNavigate } from "@tanstack/react-router";
import { User as UserIcon, Repeat } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

function initialsOf(input: string | null | undefined): string {
  if (!input) return "?";
  const parts = input.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function UserMenu() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div className="h-9 w-9 rounded-full bg-muted animate-pulse" aria-hidden />;
  }

  if (!user) {
    return <Button variant="secondary" size="sm" onClick={() => navigate({ to: "/onboarding" })}>Демо</Button>;
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    (meta.full_name as string | undefined) ||
    (meta.name as string | undefined) ||
    user.email ||
    "Пользователь";
  const avatarUrl = (meta.avatar_url as string | undefined) || (meta.picture as string | undefined);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Меню профиля"
      >
        <Avatar className="h-9 w-9 border border-border">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
          <AvatarFallback className="text-xs font-semibold">{initialsOf(displayName)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {user.email ? (
            <span className="text-xs font-normal text-muted-foreground truncate">{user.email}</span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
            <UserIcon className="h-4 w-4" />
            Мой профиль
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async (event) => {
            event.preventDefault();
            window.localStorage.removeItem("educaite-demo-role");
            navigate({ to: "/onboarding" });
          }}
          className="cursor-pointer"
        >
          <Repeat className="h-4 w-4 mr-2" />
          Сменить роль
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
