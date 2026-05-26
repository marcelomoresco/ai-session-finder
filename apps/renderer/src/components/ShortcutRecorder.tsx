import { useState } from 'react';
import { eventToAccelerator } from '../lib/accelerator';

export interface ShortcutRecorderProps {
  readonly value: string;
  readonly onChange: (accelerator: string) => void;
}

/** Click to record; the next valid Cmd/Ctrl/Alt combo becomes the launcher shortcut. Esc cancels. */
export function ShortcutRecorder({ value, onChange }: ShortcutRecorderProps) {
  const [recording, setRecording] = useState(false);

  return (
    <button
      type="button"
      aria-label="Launcher shortcut"
      onClick={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={(event) => {
        if (!recording) return;
        event.preventDefault();
        if (event.code === 'Escape') {
          setRecording(false);
          return;
        }
        const accelerator = eventToAccelerator(event);
        if (accelerator !== null) {
          onChange(accelerator);
          setRecording(false);
        }
      }}
      className="rounded-md bg-white/10 px-2 py-1 font-mono text-xs ring-1 ring-inset ring-white/10 hover:bg-white/15"
    >
      {recording ? 'Press keys…' : value}
    </button>
  );
}
