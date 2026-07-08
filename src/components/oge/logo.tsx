import logoAsset from "@/assets/pathy-logo.png.asset.json";

/**
 * Pathy wordmark: uploaded icon + "Path" ink + "y" mustard.
 * Sizes tuned for compact (rail) and default (hero-adjacent) use.
 */
export function PathyLogo({
  size = "sm",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const px = size === "lg" ? 40 : size === "md" ? 28 : 22;
  const fontSize = size === "lg" ? 22 : size === "md" ? 18 : 14;
  return (
    <span className={"inline-flex items-center gap-2 " + (className ?? "")}>
      <img
        src={logoAsset.url}
        alt=""
        aria-hidden
        width={px}
        height={px}
        style={{ display: "block" }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize,
          letterSpacing: size === "sm" ? "0.22em" : "0.14em",
          textTransform: size === "sm" ? "uppercase" : "none",
          color: "var(--pf-ink)",
          lineHeight: 1,
        }}
      >
        Path<span style={{ color: "var(--pf-mustard)" }}>y</span>
      </span>
    </span>
  );
}
