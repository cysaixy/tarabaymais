import { MAISY_IMAGES, type MaisyMood } from "../lib/maisyMood";

export const DEFAULT_MAISY_MESSAGE =
  "Mabuhay! Ako si Maisy, handang tumulong sa 'yo ngayong araw!";

interface MaisyGreetingProps {
  userName: string;
  message?: string;
  /** Which version of Maisy to show (follows the weather / corn alerts). */
  mood?: MaisyMood;
  /** Optional button under Maisy's message, e.g. "Tingnan ang hula". */
  actionLabel?: string;
  onAction?: () => void;
}

const MOOD_ALT: Record<MaisyMood, string> = {
  default: "Si Maisy, ang iyong corn farming assistant",
  happy: "Nakangiting Maisy — magandang panahon",
  rain: "Si Maisy na may payong — uulan",
  storm: "Nag-aalalang Maisy — may babala sa panahon",
  hot: "Si Maisy na naka-shades — mainit",
  sick: "Nag-aalalang Maisy na may magnifying glass — may problema sa mais",
  night: "Inaantok na si Maisy — gabi na",
};

// Bubble accent follows the mood so urgent messages stand out.
const MOOD_ACCENT: Record<MaisyMood, { bg: string; name: string; button: string }> = {
  default: { bg: "bg-[#E8F8EE]", name: "text-emerald-700", button: "bg-emerald-600 hover:bg-emerald-700" },
  happy: { bg: "bg-[#E8F8EE]", name: "text-emerald-700", button: "bg-emerald-600 hover:bg-emerald-700" },
  night: { bg: "bg-[#E6E9F5]", name: "text-indigo-700", button: "bg-indigo-600 hover:bg-indigo-700" },
  rain: { bg: "bg-[#E3F0FC]", name: "text-blue-700", button: "bg-blue-600 hover:bg-blue-700" },
  hot: { bg: "bg-[#FDF3DC]", name: "text-amber-700", button: "bg-amber-600 hover:bg-amber-700" },
  storm: { bg: "bg-[#FDE8E8]", name: "text-red-700", button: "bg-red-600 hover:bg-red-700" },
  sick: { bg: "bg-[#FDE8E8]", name: "text-red-700", button: "bg-red-600 hover:bg-red-700" },
};

// Fixed pseudo-random drops so the rain looks natural but renders the same every time.
const DROP_COUNT = 48;
const RAIN_DROPS = Array.from({ length: DROP_COUNT }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return {
    // Spread across the band, extending past the right edge since drops drift left as they fall.
    left: `${(i / DROP_COUNT) * 112 + r(1) * 2}%`,
    delay: `${-r(2) * 1.2}s`,
    speed: 0.75 + r(3) * 0.35,
    length: 12 + Math.round(r(4) * 10),
    opacity: 0.6 + r(5) * 0.35,
  };
});

/** Animated falling rain behind Maisy and her bubble (rain/storm moods only). */
function RainOverlay({ storm }: { storm: boolean }) {
  const drops = storm ? RAIN_DROPS : RAIN_DROPS.filter((_, i) => i % 4 !== 0);
  return (
    <div aria-hidden="true" className="maisy-rain pointer-events-none absolute inset-0 -z-10">
      {drops.map((d, i) => (
        <span
          key={i}
          className="maisy-raindrop"
          style={{
            left: d.left,
            height: d.length,
            opacity: d.opacity,
            animationDelay: d.delay,
            animationDuration: `${(storm ? 0.6 : 0.9) * d.speed}s`,
          }}
        />
      ))}
      {storm && <span className="maisy-lightning" />}
    </div>
  );
}

const formatFilipinoDate =(date: Date): string =>
  new Intl.DateTimeFormat("fil-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
    .format(date)
    .toLocaleUpperCase("fil-PH");

/** Maisy's greeting; her look and message follow the weather and corn alerts. */
export function MaisyGreeting({
  userName,
  message = DEFAULT_MAISY_MESSAGE,
  mood = "default",
  actionLabel,
  onAction,
}: MaisyGreetingProps) {
  const accent = MOOD_ACCENT[mood];
  return (
    <section aria-label="Bati mula kay Maisy" className="w-full">
      <div className="bg-white px-1 pb-5 pt-1 sm:pb-6">
        <p className="text-xs font-bold tracking-[0.08em] text-slate-500">
          {formatFilipinoDate(new Date())}
        </p>
        <h2 className="mt-1 text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Mabuhay, {userName}!
        </h2>
      </div>

      {/* Outer radius = bubble radius (24px) + padding, so the corners nest evenly. */}
      <div className={`relative isolate flex w-full items-center gap-3 overflow-hidden rounded-[40px] px-4 py-4 ring-1 ring-inset ring-black/5 sm:rounded-[44px] sm:px-5 sm:py-5 transition-colors ${accent.bg}`}>
        {(mood === "rain" || mood === "storm") && <RainOverlay storm={mood === "storm"} />}
        <img
          key={mood}
          src={MAISY_IMAGES[mood]}
          alt={MOOD_ALT[mood]}
          data-mood={mood}
          className="maisy-mascot h-[120px] w-auto shrink-0 object-contain sm:h-[132px]"
          style={{ imageRendering: "pixelated" }}
        />

        <div className="relative min-w-0 flex-1 rounded-[24px] bg-white px-4 py-4 text-slate-900 sm:px-5 sm:py-5">
          <span
            aria-hidden="true"
            className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 bg-white"
          />
          <div className="relative" aria-live="polite">
            <p className={`text-lg font-extrabold leading-tight ${accent.name}`}>Maisy</p>
            <p className="mt-1 text-base font-medium leading-relaxed text-slate-800">
              {message}
            </p>
            {actionLabel && onAction && (
              <button
                type="button"
                onClick={onAction}
                className={`mt-3 inline-flex min-h-12 items-center rounded-2xl px-4 text-[15px] font-extrabold text-white shadow-sm transition active:scale-[0.99] cursor-pointer ${accent.button}`}
              >
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
