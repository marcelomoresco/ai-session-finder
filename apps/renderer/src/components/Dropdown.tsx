import { useEffect, useRef, useState } from 'react';

export interface DropdownOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface DropdownProps<T extends string> {
  readonly value: T;
  readonly options: ReadonlyArray<DropdownOption<T>>;
  readonly onChange: (value: T) => void;
  /** Accessible name for the trigger (also what tests query). */
  readonly label: string;
}

/**
 * A dark, on-brand picker (button + popover list) that replaces the OS `<select>`,
 * which renders poorly on the frosted launcher theme. Closes on outside click or Escape.
 */
export function Dropdown<T extends string>({ value, options, onChange, label }: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find((option) => option.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className="flex items-center gap-2 rounded-lg bg-white/[0.08] px-2.5 py-1.5 text-sm text-zinc-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.12]"
      >
        {current?.label ?? value}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden className="text-zinc-500">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1.5 min-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-[#1c1c20] p-1 shadow-xl shadow-black/50"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                    selected ? 'bg-white/10 text-zinc-100' : 'text-zinc-300 hover:bg-white/[0.06]'
                  }`}
                >
                  {option.label}
                  {selected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
