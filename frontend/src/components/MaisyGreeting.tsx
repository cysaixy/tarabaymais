export const DEFAULT_MAISY_MESSAGE =
  "Mabuhay! Ako si Maisy, handang tumulong sa 'yo ngayong araw!";

interface MaisyGreetingProps {
  userName: string;
  message?: string;
}

const formatFilipinoDate = (date: Date): string =>
  new Intl.DateTimeFormat("fil-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
    .format(date)
    .toLocaleUpperCase("fil-PH");

/** A short, reusable welcome from Maisy for the farmer dashboard. */
export function MaisyGreeting({
  userName,
  message = DEFAULT_MAISY_MESSAGE,
}: MaisyGreetingProps) {
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

      <div className="flex w-full items-center gap-3 bg-[#E8F8EE] px-4 py-4 sm:px-5 sm:py-5">
        <img
          src="/assets/mascot-maisy.png"
          alt="Maisy, ang iyong corn farming assistant"
          className="h-[112px] w-auto shrink-0 object-contain sm:h-[120px]"
          style={{ imageRendering: "pixelated" }}
        />

        <div className="relative min-w-0 flex-1 rounded-[24px] bg-white px-4 py-4 text-slate-900 sm:px-5 sm:py-5">
          <span
            aria-hidden="true"
            className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 bg-white"
          />
          <div className="relative">
            <p className="text-lg font-extrabold leading-tight text-emerald-700">
              Maisy
            </p>
            <p className="mt-1 text-base font-medium leading-relaxed text-slate-800">
              {message}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
