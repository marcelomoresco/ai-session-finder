export interface ToggleProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Accessible name; also what tests query via getByLabelText. */
  readonly label: string;
}

/**
 * A sliding pill switch built on a real (visually-hidden) checkbox, so it keeps
 * the checkbox role + accessible label while looking custom. Matches the dark,
 * frosted launcher aesthetic.
 */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <span className="relative inline-flex h-[22px] w-9 shrink-0 items-center">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
      />
      <span className="absolute inset-0 rounded-full bg-white/[0.12] ring-1 ring-inset ring-white/10 transition-colors duration-200 peer-checked:bg-emerald-500/80 peer-checked:ring-emerald-400/30 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-400/60" />
      <span className="pointer-events-none absolute left-[3px] h-4 w-4 rounded-full bg-zinc-100 shadow-sm transition-transform duration-200 ease-out peer-checked:translate-x-[14px]" />
    </span>
  );
}
