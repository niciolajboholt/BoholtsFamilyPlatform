import { useEffect, useState } from "react";

import { useFamilyId } from "../hooks/useFamilyId";
import { deleteEventReminder, getEventReminder, setEventReminder } from "./eventReminderApi";

interface UseEventReminderResult {
  offsetMinutes: number | null;
  setReminder: (offsetMinutes: number | null) => void;
}

/**
 * Henter og opdaterer påmindelsen for EN EKSISTERENDE aftale (bruges af
 * EditEventDialog) — eventId er null, indtil aftalen er valgt/åben.
 * NewEventDialog bruger IKKE dette hook, da en ny aftale endnu ikke har et
 * event-id at knytte påmindelsen til; den sætter i stedet påmindelsen som
 * et separat kald, EFTER aftalen er oprettet (se CalendarPage).
 */
export function useEventReminder(
  eventId: string | null,
): UseEventReminderResult {
  const familyId = useFamilyId();
  const [offsetMinutes, setOffsetMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (!familyId || !eventId) {
      return;
    }

    let isCancelled = false;

    getEventReminder(familyId, eventId).then((result) => {
      if (!isCancelled && result.ok) {
        setOffsetMinutes(result.data.reminder?.offsetMinutes ?? null);
      }
    });

    return () => {
      isCancelled = true;
    };
    // eventId indgår i nøglen — et skift til en anden aftale henter dennes
    // egen påmindelse. Den forrige aftales værdi vises kortvarigt, indtil
    // svaret kommer tilbage (samme mønster som useShoppingList.ts's
    // vare-hentning, der heller ikke nulstiller synkront først).
  }, [familyId, eventId]);

  function setReminder(nextOffsetMinutes: number | null): void {
    if (!familyId || !eventId) {
      return;
    }

    // Optimistisk — dropdown'en skal føles øjeblikkelig, og en fejlet
    // gemning her har ingen synlig konsekvens ud over at påmindelsen ikke
    // reelt blev sat (opdages senest næste gang dialogen åbnes igen).
    setOffsetMinutes(nextOffsetMinutes);

    if (nextOffsetMinutes === null) {
      void deleteEventReminder(familyId, eventId);
    } else {
      void setEventReminder(familyId, eventId, nextOffsetMinutes);
    }
  }

  return { offsetMinutes, setReminder };
}
