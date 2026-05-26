import { describe, it, expect } from 'vitest';
import { eventToAccelerator, type ShortcutKeyEvent } from './accelerator';

const ev = (over: Partial<ShortcutKeyEvent>): ShortcutKeyEvent => ({
  code: '',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...over,
});

describe('eventToAccelerator', () => {
  it('maps Cmd+Shift+Space to a cross-platform accelerator', () => {
    expect(eventToAccelerator(ev({ code: 'Space', metaKey: true, shiftKey: true }))).toBe(
      'CommandOrControl+Shift+Space',
    );
  });

  it('maps Ctrl+Alt+letter', () => {
    expect(eventToAccelerator(ev({ code: 'KeyK', ctrlKey: true, altKey: true }))).toBe(
      'CommandOrControl+Alt+K',
    );
  });

  it('maps function keys, digits and arrows', () => {
    expect(eventToAccelerator(ev({ code: 'F5', metaKey: true }))).toBe('CommandOrControl+F5');
    expect(eventToAccelerator(ev({ code: 'Digit2', metaKey: true }))).toBe('CommandOrControl+2');
    expect(eventToAccelerator(ev({ code: 'ArrowUp', altKey: true }))).toBe('Alt+Up');
  });

  it('rejects a bare key with no modifier', () => {
    expect(eventToAccelerator(ev({ code: 'KeyA' }))).toBeNull();
  });

  it('rejects shift-only combos and modifier-only presses', () => {
    expect(eventToAccelerator(ev({ code: 'KeyA', shiftKey: true }))).toBeNull();
    expect(eventToAccelerator(ev({ code: 'MetaLeft', metaKey: true }))).toBeNull();
  });
});
