import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

interface UseSwipeNavigationOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  minDistancePx?: number;
}

interface SwipeNavigationHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: () => void;
}

// Swipe for at skifte dag/uge/måned — kun finger-/pen-tryk (pointerType
// "mouse" springes over, museklik er allerede dækket af </>-knapperne i
// CalendarToolbar). Måler kun start- og slutposition, rører aldrig
// preventDefault/stopPropagation undervejs — browserens egen lodrette scroll
// (fx dagvisningens tidslinje) og alle knap-tryk (dagceller, aftale-chips)
// fortsætter derfor upåvirket. Et swipe tæller kun, hvis den vandrette
// bevægelse er både lang nok OG mere vandret end lodret — ellers er det en
// scroll, ikke et sideskift.
export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  minDistancePx = 40,
}: UseSwipeNavigationOptions): SwipeNavigationHandlers {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(event: ReactPointerEvent) {
    if (event.pointerType === "mouse") {
      return;
    }

    startRef.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: ReactPointerEvent) {
    const start = startRef.current;
    startRef.current = null;

    if (!start) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    // Et rigtigt fingerswipe er sjældent lodret-vandret 1:1 — kræver kun at
    // den vandrette bevægelse er den klart dominerende (mindst dobbelt så
    // stor som den lodrette), ikke strengt større end den.
    if (Math.abs(deltaX) < minDistancePx || Math.abs(deltaX) < Math.abs(deltaY) * 2) {
      return;
    }

    if (deltaX < 0) {
      onSwipeLeft();
    } else {
      onSwipeRight();
    }
  }

  function onPointerCancel() {
    startRef.current = null;
  }

  return { onPointerDown, onPointerUp, onPointerCancel };
}
