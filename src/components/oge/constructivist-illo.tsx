// Абстрактная композиция в духе конструктивизма / Bauhaus.
// Без школьников, без персонажей — только формы, линии, ритм.
// На экране — только один доминирующий акцентный цвет.

type Variant = "today" | "calendar" | "library" | "profile" | "ai" | "minimal";

const PALETTE = {
  ink: "#202124",
  paper: "#F7F4EE",
  line: "#C9C5BB",
  cinnabar: "#D6452F",
  ultramarine: "#3559C7",
  mustard: "#D7A52A",
  forest: "#3D6A4A",
};

export function ConstructivistIllo({
  variant = "today",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  switch (variant) {
    case "calendar":
      return (
        <svg viewBox="0 0 400 280" className={className} role="img" aria-hidden>
          <line x1="10" y1="140" x2="390" y2="140" stroke={PALETTE.ink} strokeWidth="1" />
          <line x1="60" y1="20" x2="60" y2="260" stroke={PALETTE.line} strokeWidth="1" />
          <circle cx="120" cy="100" r="36" fill={PALETTE.ultramarine} />
          <rect x="200" y="60" width="80" height="80" fill={PALETTE.ink} transform="rotate(18 240 100)" />
          <rect x="170" y="170" width="50" height="50" fill={PALETTE.cinnabar} />
          <line x1="280" y1="170" x2="380" y2="220" stroke={PALETTE.ink} strokeWidth="2" />
          <circle cx="380" cy="220" r="4" fill={PALETTE.ink} />
        </svg>
      );
    case "library":
      return (
        <svg viewBox="0 0 400 280" className={className} role="img" aria-hidden>
          <rect x="40" y="40" width="80" height="200" stroke={PALETTE.ink} strokeWidth="1" fill="none" />
          <rect x="140" y="80" width="80" height="160" fill={PALETTE.line} />
          <rect x="240" y="40" width="60" height="60" fill={PALETTE.mustard} />
          <line x1="240" y1="120" x2="380" y2="120" stroke={PALETTE.ink} />
          <line x1="240" y1="160" x2="380" y2="160" stroke={PALETTE.ink} />
          <line x1="240" y1="200" x2="320" y2="200" stroke={PALETTE.ink} />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 400 280" className={className} role="img" aria-hidden>
          <polygon points="40,240 200,40 360,240" stroke={PALETTE.ink} strokeWidth="1" fill="none" />
          <circle cx="200" cy="160" r="50" fill={PALETTE.forest} />
          <rect x="280" y="180" width="40" height="40" fill={PALETTE.ink} />
          <line x1="40" y1="240" x2="360" y2="240" stroke={PALETTE.ink} strokeWidth="2" />
          <circle cx="120" cy="200" r="3" fill={PALETTE.ink} />
          <circle cx="200" cy="100" r="3" fill={PALETTE.ink} />
          <circle cx="290" cy="180" r="3" fill={PALETTE.ink} />
        </svg>
      );
    case "ai":
      return (
        <svg viewBox="0 0 400 280" className={className} role="img" aria-hidden>
          <line x1="40" y1="140" x2="360" y2="140" stroke={PALETTE.ink} />
          <line x1="200" y1="20" x2="200" y2="260" stroke={PALETTE.line} />
          <circle cx="200" cy="140" r="60" stroke={PALETTE.ink} strokeWidth="1" fill="none" />
          <circle cx="200" cy="140" r="14" fill={PALETTE.ultramarine} />
          <rect x="60" y="60" width="40" height="40" fill={PALETTE.ink} />
          <rect x="300" y="180" width="40" height="40" fill={PALETTE.ink} />
        </svg>
      );
    case "minimal":
      return (
        <svg viewBox="0 0 400 280" className={className} role="img" aria-hidden>
          <line x1="40" y1="140" x2="360" y2="140" stroke={PALETTE.ink} />
          <circle cx="120" cy="140" r="40" fill={PALETTE.ink} />
          <rect x="240" y="100" width="80" height="80" fill={PALETTE.cinnabar} />
        </svg>
      );
    case "today":
    default:
      return (
        <svg viewBox="0 0 480 360" className={className} role="img" aria-hidden>
          {/* grid */}
          <g stroke={PALETTE.line} strokeWidth="1">
            <line x1="60" y1="0" x2="60" y2="360" />
            <line x1="0" y1="180" x2="480" y2="180" />
          </g>
          {/* circle */}
          <circle cx="200" cy="170" r="70" fill={PALETTE.ultramarine} />
          {/* red square */}
          <rect x="240" y="120" width="120" height="160" fill={PALETTE.cinnabar} />
          {/* black bar */}
          <rect x="310" y="220" width="120" height="22" fill={PALETTE.ink} transform="rotate(28 370 230)" />
          {/* mustard square */}
          <rect x="380" y="80" width="42" height="42" fill={PALETTE.mustard} />
          {/* arrow line */}
          <line x1="80" y1="320" x2="430" y2="40" stroke={PALETTE.ink} strokeWidth="1.5" />
          <polygon points="430,40 420,52 420,32" fill={PALETTE.ink} />
          {/* cross */}
          <g stroke={PALETTE.ink} strokeWidth="1.5">
            <line x1="120" y1="280" x2="150" y2="280" />
            <line x1="135" y1="265" x2="135" y2="295" />
          </g>
          {/* small dot */}
          <circle cx="60" cy="80" r="4" fill={PALETTE.ink} />
        </svg>
      );
  }
}
