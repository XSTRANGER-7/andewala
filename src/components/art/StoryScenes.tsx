/**
 * Three flat illustrations for the "How it works" story. Each is a 320×220
 * SVG using the site palette; small CSS animations (see globals.css) give
 * them life: a tap ripple, a riding scooter, twinkling sparkles.
 */
import type { SVGProps } from "react";

const INK = "#1c2420";
const FOREST = "#1f4d3f";
const SAGE = "#7ea891";
const SAGE_DARK = "#648f78";
const MINT = "#e9f1eb";
const MINT_2 = "#d9e7dd";
const YOLK = "#f0a400";
const SHELL = "#f3ead9";
const SHELL_EDGE = "#d6c8b1";
const SKIN = "#e8b894";
const TERRACOTTA = "#c97b5a";
const PAPER = "#ffffff";

type P = SVGProps<SVGSVGElement>;

function Frame({ children, label, ...rest }: P & { label: string }) {
  return (
    <svg viewBox="0 0 320 220" role="img" aria-label={label} className="block h-auto w-full" {...rest}>
      <rect x="0" y="0" width="320" height="220" rx="18" fill={MINT} />
      {children}
    </svg>
  );
}

/** A tray of eggs, small, for crates and hands. */
function MiniTray({ x, y, w = 64, cols = 4, rows = 2 }: { x: number; y: number; w?: number; cols?: number; rows?: number }) {
  const cell = w / cols;
  const h = cell * rows * 0.9 + 6;
  const eggs = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      eggs.push(<ellipse key={`${r}${c}`} cx={x + cell / 2 + c * cell} cy={y + 4 + cell * 0.45 + r * cell * 0.9} rx={cell * 0.32} ry={cell * 0.38} fill={SHELL} stroke={SHELL_EDGE} strokeWidth="0.8" />);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="4" fill={SAGE} />
      {eggs}
    </g>
  );
}

/** Scene 1: a customer orders on the phone. */
export function SceneOrder(props: P) {
  return (
    <Frame label="A customer taps Order on the AndeWala app" {...props}>
      {/* soft shapes */}
      <circle cx="60" cy="60" r="34" fill={MINT_2} />
      <circle cx="270" cy="170" r="44" fill={MINT_2} />
      {/* phone */}
      <rect x="112" y="18" width="96" height="186" rx="16" fill={INK} />
      <rect x="118" y="26" width="84" height="170" rx="11" fill={PAPER} />
      <rect x="146" y="30" width="28" height="4" rx="2" fill={MINT_2} />
      {/* app screen */}
      <text x="124" y="52" fontFamily="var(--font-display)" fontWeight="800" fontSize="11" fill={INK}>
        andewala
      </text>
      <rect x="124" y="58" width="72" height="54" rx="8" fill={MINT} />
      <MiniTray x={134} y={66} w={52} cols={4} rows={2} />
      <text x="124" y="128" fontFamily="var(--font-display)" fontWeight="800" fontSize="15" fill={INK}>
        ₹210
      </text>
      <text x="162" y="128" fontFamily="var(--font-sans)" fontSize="7" fill="#848b85">
        / tray
      </text>
      <rect x="124" y="136" width="72" height="8" rx="2" fill={MINT_2} />
      <rect x="124" y="148" width="48" height="8" rx="2" fill={MINT_2} />
      <rect x="124" y="166" width="72" height="20" rx="6" fill={SAGE} />
      <text x="160" y="180" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="700" fontSize="9" fill={PAPER}>
        Order now
      </text>
      {/* tap ripple + fingertip */}
      <circle className="tap-ring" cx="176" cy="176" r="10" fill="none" stroke={YOLK} strokeWidth="3" />
      <circle className="tap-ring" style={{ animationDelay: "0.6s" }} cx="176" cy="176" r="10" fill="none" stroke={YOLK} strokeWidth="3" />
      <g className="tap-finger">
        <rect x="170" y="172" width="22" height="46" rx="11" fill={SKIN} />
        <rect x="186" y="186" width="16" height="36" rx="8" fill={SKIN} />
      </g>
      {/* confirmation toast */}
      <g className="pop-late">
        <rect x="200" y="40" width="98" height="30" rx="15" fill={FOREST} />
        <circle cx="216" cy="55" r="7" fill={YOLK} />
        <path d="M212.5 55l2.5 2.5 5-5" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <text x="229" y="58" fontFamily="var(--font-sans)" fontWeight="700" fontSize="9" fill={PAPER}>
          Order placed
        </text>
      </g>
    </Frame>
  );
}

/** Scene 2: the rider collects today's eggs at the farm. */
export function SceneFarm(props: P) {
  return (
    <Frame label="A rider on a scooter collects egg trays from the farm" {...props}>
      {/* sun */}
      <g className="sun" style={{ transformOrigin: "52px 46px" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={i} x1="52" y1="46" x2={52 + Math.cos((i * Math.PI) / 4) * 30} y2={46 + Math.sin((i * Math.PI) / 4) * 30} stroke={YOLK} strokeWidth="3" strokeLinecap="round" opacity=".6" />
        ))}
      </g>
      <circle cx="52" cy="46" r="16" fill={YOLK} />
      {/* ground */}
      <path d="M0 170c60-14 120-14 160-6s100 10 160 0v56H0z" fill={MINT_2} />
      <path d="M0 184c70-10 140-6 200 2s80 6 120 0v34H0z" fill={SAGE} opacity=".55" />
      {/* barn */}
      <rect x="30" y="104" width="92" height="66" fill={TERRACOTTA} />
      <path d="M22 106l54-40 54 40z" fill="#a85f42" />
      <rect x="60" y="126" width="30" height="44" rx="3" fill="#7a4631" />
      <path d="M60 126l30 44M90 126l-30 44" stroke="#c97b5a" strokeWidth="2" />
      <rect x="40" y="114" width="14" height="12" rx="2" fill={SHELL} />
      <rect x="100" y="114" width="14" height="12" rx="2" fill={SHELL} />
      <text x="76" y="95" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="9" fill={PAPER}>
        FARM
      </text>
      {/* hen */}
      <g className="hen" style={{ transformOrigin: "140px 164px" }}>
        <ellipse cx="140" cy="160" rx="16" ry="11" fill={PAPER} stroke={SHELL_EDGE} />
        <path d="M124 158c-6-2-10 2-8 6 3-3 6-3 8-6z" fill={PAPER} stroke={SHELL_EDGE} />
        <circle cx="154" cy="150" r="7" fill={PAPER} stroke={SHELL_EDGE} />
        <path d="M160 151l7 2-7 3z" fill={YOLK} />
        <path d="M150 143c1-4 4-5 6-3 1-3 5-3 5 1-3 0-6 1-11 2z" fill="#d94b3c" />
        <circle cx="156" cy="149" r="1.2" fill={INK} />
        <path d="M136 170v6M144 170v6" stroke={YOLK} strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* egg crates stacked by the barn */}
      <MiniTray x={166} y={150} w={40} cols={3} rows={1} />
      <MiniTray x={166} y={166} w={40} cols={3} rows={1} />
      {/* rider + scooter */}
      <g className="ride" style={{ transformOrigin: "255px 170px" }}>
        {/* crate on the back */}
        <MiniTray x={214} y={128} w={44} cols={3} rows={2} />
        {/* scooter body */}
        <path d="M222 168h40l10-22h12v6h-8l-9 20h8" fill="none" stroke={SAGE_DARK} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="236" y="150" width="30" height="12" rx="6" fill={SAGE_DARK} />
        <path d="M286 140l10-6" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        {/* rider */}
        <circle cx="272" cy="118" r="10" fill={SKIN} />
        <path d="M261 117a11 11 0 0 1 22 0z" fill={FOREST} />
        <path d="M264 128h16l6 26h-26z" fill={FOREST} />
        <path d="M278 134l14 4" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
        <path d="M268 154l-6 14M276 154l2 14" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        {/* wheels */}
        <g className="wheel" style={{ transformOrigin: "232px 176px" }}>
          <circle cx="232" cy="176" r="11" fill={INK} />
          <circle cx="232" cy="176" r="5" fill={PAPER} />
          <path d="M232 165v22M221 176h22" stroke={PAPER} strokeWidth="1.5" />
        </g>
        <g className="wheel" style={{ transformOrigin: "288px 176px" }}>
          <circle cx="288" cy="176" r="11" fill={INK} />
          <circle cx="288" cy="176" r="5" fill={PAPER} />
          <path d="M288 165v22M277 176h22" stroke={PAPER} strokeWidth="1.5" />
        </g>
      </g>
      {/* motion lines */}
      <g className="whoosh" stroke={SAGE_DARK} strokeWidth="2" strokeLinecap="round" opacity=".7">
        <path d="M196 150h12M190 158h16M198 166h10" />
      </g>
    </Frame>
  );
}

/** Scene 3: the tray handed over at the customer's door. */
export function SceneDoor(props: P) {
  return (
    <Frame label="The rider hands a tray of fresh eggs to a customer at their door" {...props}>
      {/* wall and floor */}
      <rect x="150" y="0" width="170" height="220" fill={MINT_2} />
      <rect x="0" y="178" width="320" height="42" fill={SAGE} opacity=".45" />
      {/* door */}
      <rect x="196" y="40" width="88" height="140" rx="4" fill={FOREST} />
      <rect x="206" y="52" width="68" height="46" rx="3" fill="#2f5d4a" />
      <rect x="206" y="108" width="68" height="60" rx="3" fill="#2f5d4a" />
      <circle cx="268" cy="118" r="4" fill={YOLK} />
      <rect x="186" y="176" width="108" height="8" rx="2" fill={TERRACOTTA} opacity=".8" />
      {/* house number */}
      <rect x="160" y="54" width="26" height="18" rx="3" fill={PAPER} />
      <text x="173" y="67" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="10" fill={INK}>
        12
      </text>
      {/* customer in the doorway */}
      <g>
        <circle cx="232" cy="96" r="11" fill={SKIN} />
        <path d="M221 92a11 11 0 0 1 22 0c-6-4-16-4-22 0z" fill={INK} />
        <path d="M218 108h28l4 44h-36z" fill={YOLK} />
        <path d="M222 118l-16 12" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
        <path d="M226 152l-2 26M240 152l2 26" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      </g>
      {/* rider handing the tray */}
      <g className="hand-over" style={{ transformOrigin: "100px 150px" }}>
        <circle cx="96" cy="84" r="12" fill={SKIN} />
        <path d="M83 83a13 13 0 0 1 26 0z" fill={FOREST} />
        <rect x="82" y="96" width="28" height="54" rx="6" fill={SAGE_DARK} />
        <path d="M108 106l24 12" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <path d="M88 150l-4 28M104 150l4 28" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <g className="tray-lift" style={{ transformOrigin: "150px 120px" }}>
          <MiniTray x={122} y={108} w={56} cols={4} rows={1} />
        </g>
      </g>
      {/* sparkles */}
      {[
        [122, 92, 0],
        [186, 100, 0.5],
        [150, 86, 1],
      ].map(([x, y, d], i) => (
        <path key={i} className="sparkle" style={{ animationDelay: `${d}s` }} d={`M${x} ${y - 7}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z`} fill={YOLK} />
      ))}
      {/* time badge */}
      <g>
        <rect x="18" y="20" width="96" height="30" rx="15" fill={PAPER} />
        <circle cx="34" cy="35" r="7" fill="none" stroke={FOREST} strokeWidth="2" />
        <path d="M34 31v4l3 2" stroke={FOREST} strokeWidth="2" fill="none" strokeLinecap="round" />
        <text x="47" y="39" fontFamily="var(--font-sans)" fontWeight="700" fontSize="10" fill={INK}>
          by 9 PM
        </text>
      </g>
    </Frame>
  );
}
