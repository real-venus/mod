"use client";

import { useFilters } from "../context/FiltersContext";

// Traders-page-only filter bar. Lives directly under <NavTabs> on the
// /traders and /traders/[address] pages. The global <Header> doesn't
// own these inputs because they're meaningless on Markets/Portfolio.
export default function TraderFilterBar() {
  const {
    daysAgo, setDaysAgo,
    minPerDay, setMinPerDay,
    minVolume, setMinVolume,
    minBuyVolume, setMinBuyVolume,
    minSellVolume, setMinSellVolume,
  } = useFilters();

  // Each control sanitizes user input — text inputs with inputMode
  // numeric/decimal so we get the numeric keyboard on mobile *and*
  // avoid the browser-rendered up/down spinner buttons.
  const onIntChange = (set: (v: string) => void, max: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === "") return set("");
    if (!/^\d+$/.test(v)) return;
    const n = Number(v);
    if (n < 0) return set("");
    if (n > max) return set(String(max));
    set(String(n));
  };
  const onDecimalChange = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === "") return set("");
    if (!/^\d*\.?\d*$/.test(v)) return;
    set(v);
  };

  const Field = ({
    label, hint, value, onChange, mode = "numeric", placeholder = "0", width = "w-16",
  }: {
    label: string;
    hint: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    mode?: "numeric" | "decimal";
    placeholder?: string;
    width?: string;
  }) => (
    <div className="flex items-center gap-1.5 shrink-0" title={hint}>
      <span className="text-[9px] text-pixel-gray tracking-wider">{label}</span>
      <input
        type="text"
        inputMode={mode}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`pixel-input ${width} text-[10px] px-2 py-1.5 text-center`}
      />
    </div>
  );

  return (
    <div className="border-b-2 border-pixel-border bg-pixel-black/80 px-4 py-2">
      <div className="max-w-[1920px] mx-auto flex items-center gap-3 flex-wrap">
        <Field
          label="DAYS BACK"
          hint="Compute the leaderboard over the last N days"
          value={daysAgo}
          onChange={onIntChange(setDaysAgo, 365)}
          placeholder="7"
        />
        <div className="w-[2px] h-3 bg-pixel-border" />
        <Field
          label="MIN/DAY"
          hint="Minimum average trades per day inside the window"
          value={minPerDay}
          onChange={onDecimalChange(setMinPerDay)}
          mode="decimal"
          placeholder="1"
          width="w-14"
        />
        <div className="w-[2px] h-3 bg-pixel-border" />
        <Field
          label="MIN VOL $"
          hint="Hide traders whose total in-window volume is below this"
          value={minVolume}
          onChange={onDecimalChange(setMinVolume)}
          mode="decimal"
          placeholder="0"
          width="w-20"
        />
        <Field
          label="MIN BUY $"
          hint="Hide traders whose in-window buy volume is below this"
          value={minBuyVolume}
          onChange={onDecimalChange(setMinBuyVolume)}
          mode="decimal"
          placeholder="0"
          width="w-20"
        />
        <Field
          label="MIN SELL $"
          hint="Hide traders whose in-window sell volume is below this"
          value={minSellVolume}
          onChange={onDecimalChange(setMinSellVolume)}
          mode="decimal"
          placeholder="0"
          width="w-20"
        />

        <button
          onClick={() => {
            setDaysAgo("");
            setMinPerDay("1");
            setMinVolume("");
            setMinBuyVolume("");
            setMinSellVolume("");
          }}
          className="ml-auto pixel-btn text-[9px] px-2 py-1 border-pixel-border text-pixel-gray hover:text-pixel-white shrink-0"
        >
          RESET FILTERS
        </button>
      </div>
    </div>
  );
}
