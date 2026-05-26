export interface ShortcutKeyEvent {
  readonly code: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

const ARROWS: Readonly<Record<string, string>> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
};

/** The non-modifier key, normalized to Electron's accelerator vocabulary, or null. */
function mainKey(code: string): string | null {
  if (code === 'Space') return 'Space';
  if (code in ARROWS) return ARROWS[code]!;
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1]!;
  const digit = /^Digit(\d)$/.exec(code);
  if (digit) return digit[1]!;
  if (/^F\d{1,2}$/.test(code)) return code;
  return null; // modifier-only (MetaLeft, ShiftLeft, …) or unsupported
}

/**
 * Converts a keydown into an Electron accelerator (e.g. `CommandOrControl+Shift+Space`),
 * or null when it isn't a usable global shortcut. Cmd/Ctrl map to the cross-platform
 * `CommandOrControl`; a non-shift modifier is required so bare/shift-only keys are rejected.
 */
export function eventToAccelerator(event: ShortcutKeyEvent): string | null {
  const key = mainKey(event.code);
  if (key === null) return null;
  if (!event.metaKey && !event.ctrlKey && !event.altKey) return null;

  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push('CommandOrControl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}
