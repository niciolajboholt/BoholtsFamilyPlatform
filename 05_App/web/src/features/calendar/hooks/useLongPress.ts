import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";

export interface LongPressPosition {
  clientX: number;
  clientY: number;
}

interface UseLongPressOptions {
  onLongPress: (position: LongPressPosition) => void;
  onClick?: () => void;
  delayMs?: number;
  moveThresholdPx?: number;
}

interface LongPressHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  onClick: () => void;
}

// Langt tryk for at oprette en aftale direkte fra kalenderens dagfelter/
// tidslinje. Et STILLESTÅENDE tryk holdt i `delayMs` tæller som langt tryk —
// en almindelig tap fortsætter med at vælge dagen/åbne den (via `onClick`),
// og en bevægelse ud over `moveThresholdPx` (fx dagvisningens scroll)
// annullerer det heller. Efter et fyret langt tryk undertrykkes den
// efterfølgende, browser-genererede click, så den samme berøring ikke også
// vælger/åbner dagen oveni at have åbnet opret-dialogen.
export function useLongPress({
  onLongPress,
  onClick,
  delayMs = 500,
  moveThresholdPx = 10,
}: UseLongPressOptions): LongPressHandlers {
  const timerRef = useRef<number | null>(null);
  const startPositionRef = useRef<LongPressPosition | null>(null);
  const firedRef = useRef(false);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function onPointerDown(event: ReactPointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const position = { clientX: event.clientX, clientY: event.clientY };
    startPositionRef.current = position;

    clearTimer();
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true;
      onLongPress(position);
    }, delayMs);
  }

  function onPointerMove(event: ReactPointerEvent) {
    const start = startPositionRef.current;

    if (!start || firedRef.current) {
      return;
    }

    const distance = Math.hypot(
      event.clientX - start.clientX,
      event.clientY - start.clientY,
    );

    if (distance > moveThresholdPx) {
      clearTimer();
      startPositionRef.current = null;
    }
  }

  function onPointerUp() {
    clearTimer();
    startPositionRef.current = null;
  }

  function onPointerLeave() {
    clearTimer();
    startPositionRef.current = null;
  }

  // Forhindrer browserens native kontekstmenu (fx en tekst-markeringsmenu på
  // langt tryk) i at dukke op oveni den dialog, det samme tryk lige åbnede.
  function onContextMenu(event: ReactMouseEvent) {
    if (firedRef.current) {
      event.preventDefault();
    }
  }

  function handleClick() {
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }

    onClick?.();
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onContextMenu,
    onClick: handleClick,
  };
}
