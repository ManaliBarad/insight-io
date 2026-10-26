// Merges keyboard (W A S D / arrow keys) and on-screen joystick input into the
// simulator's manual command. Returns the active directions for highlighting.

import { useCallback, useEffect, useRef, useState } from 'react';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

export function useDriveInput(sim, enabled) {
  const keys = useRef(new Set());
  const pad = useRef(new Set());
  const [active, setActive] = useState(() => new Set());

  const apply = useCallback(() => {
    const all = new Set([...keys.current, ...pad.current]);
    setActive(all);
    sim.manual.forward = enabled ? (all.has('up') ? 1 : 0) - (all.has('down') ? 1 : 0) : 0;
    sim.manual.turn = enabled ? (all.has('left') ? 1 : 0) - (all.has('right') ? 1 : 0) : 0;
  }, [sim, enabled]);

  useEffect(() => {
    const down = (e) => {
      const dir = KEYMAP[e.code];
      if (!dir || isTyping(e.target) || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      keys.current.add(dir);
      apply();
    };
    const up = (e) => {
      const dir = KEYMAP[e.code];
      if (!dir) return;
      keys.current.delete(dir);
      apply();
    };
    const blur = () => {
      keys.current.clear();
      pad.current.clear();
      apply();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    apply();
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [apply]);

  const press = useCallback(
    (dir, on) => {
      if (on) pad.current.add(dir);
      else pad.current.delete(dir);
      apply();
    },
    [apply],
  );

  return { active, press };
}
