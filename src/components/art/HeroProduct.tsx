import { cn } from "@/lib/cn";

/**
 * Product hero: a 30-egg tray resting on a stone slab with one egg standing
 * in front. With `animated`, the tray floats and the eggs pop in one by one.
 */
export function HeroProduct({ className, animated = false }: { className?: string; animated?: boolean }) {
  const eggs = [];
  for (let r = 0; r < 5; r++) {
    for (let k = 0; k < 6; k++) {
      const x = 150 + k * 46 + r * 12;
      const y = 120 + r * 34;
      const i = r * 6 + k;
      eggs.push(
        <g key={`${r}-${k}`} className={animated ? "egg-pop" : undefined} style={animated ? { animationDelay: `${120 + i * 28}ms` } : undefined}>
          <ellipse cx={x} cy={y + 4} rx="18" ry="9" fill="rgb(0 0 0 / .08)" />
          <ellipse cx={x} cy={y} rx="17" ry="20" fill="url(#shell)" stroke="#d6c8b1" strokeWidth="1" />
          <ellipse cx={x - 5} cy={y - 7} rx="5" ry="7" fill="white" fillOpacity=".55" />
        </g>,
      );
    }
  }
  return (
    <svg className={cn("block h-auto w-full", animated && "float", className)} viewBox="0 0 640 420" role="img" aria-label="A tray of thirty farm-fresh eggs on a stone slab">
      <defs>
        <radialGradient id="shell" cx="40%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fbf5e8" />
          <stop offset="100%" stopColor="#e9dcc3" />
        </radialGradient>
        <radialGradient id="stone" cx="45%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#c9c3b6" />
          <stop offset="100%" stopColor="#8f887b" />
        </radialGradient>
        <linearGradient id="tray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b9cfbf" />
          <stop offset="100%" stopColor="#8fb09d" />
        </linearGradient>
      </defs>

      {/* stone slab */}
      <ellipse cx="330" cy="340" rx="300" ry="22" fill="rgb(0 0 0 / .10)" />
      <path d="M40 300c40-28 160-46 290-46s250 18 290 46c-30 30-150 50-290 50S70 330 40 300Z" fill="url(#stone)" />
      <path d="M40 300c40-28 160-46 290-46s250 18 290 46" fill="none" stroke="#e6e1d6" strokeOpacity=".6" strokeWidth="3" />

      {/* tray body in light perspective */}
      <path d="M118 96h300l62 180H76z" fill="url(#tray)" />
      <path d="M118 96h300l10 30H108z" fill="#d9e7dd" />
      <path d="M76 276h404" stroke="#648f78" strokeWidth="3" />
      {eggs}

      {/* standing egg */}
      <g className={animated ? "egg-pop" : undefined} style={animated ? { animationDelay: "1050ms" } : undefined}>
        <ellipse cx="520" cy="300" rx="34" ry="12" fill="rgb(0 0 0 / .12)" />
        <path d="M520 190c-26 0-50 44-50 78a50 50 0 0 0 100 0c0-34-24-78-50-78Z" fill="url(#shell)" stroke="#d6c8b1" strokeWidth="1.5" />
        <ellipse cx="505" cy="228" rx="10" ry="16" fill="white" fillOpacity=".55" />
      </g>

      {/* yolk accent badge */}
      <g className={animated ? "egg-pop" : undefined} style={animated ? { animationDelay: "1200ms" } : undefined}>
        <circle cx="96" cy="78" r="34" fill="#f0a400" />
        <text x="96" y="74" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="22" fill="#2a1d00">
          30
        </text>
        <text x="96" y="92" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="600" fontSize="11" fill="#4a3200">
          EGGS
        </text>
      </g>
    </svg>
  );
}
