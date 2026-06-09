import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Страница не найдена</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Возможно, ссылка устарела или страница была перемещена.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "educaite" },
      {
        name: "description",
        content: "Персонализированная подготовка к ОГЭ с диагностикой, календарём и AI-рекомендациями.",
      },
      { name: "author", content: "Lovable" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "educaite" },
      { name: "twitter:title", content: "educaite" },
      { name: "description", content: "educaite is an AI-powered web app for personalized OGE exam preparation for 9th graders." },
      { property: "og:description", content: "educaite is an AI-powered web app for personalized OGE exam preparation for 9th graders." },
      { name: "twitter:description", content: "educaite is an AI-powered web app for personalized OGE exam preparation for 9th graders." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/77aa4795-ccaf-4737-be5c-dc0e21339643/id-preview-5f235a8b--6be1e37b-2ce0-4f75-8d64-751227ba3518.lovable.app-1777058603657.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/77aa4795-ccaf-4737-be5c-dc0e21339643/id-preview-5f235a8b--6be1e37b-2ce0-4f75-8d64-751227ba3518.lovable.app-1777058603657.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-screen-style="clean-minimal" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
