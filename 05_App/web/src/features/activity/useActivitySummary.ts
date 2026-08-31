import { useCallback, useEffect, useState } from "react";

import { acknowledgeActivity, getActivitySince, type ActiveActivitySummary } from "../family/familyApi";
import { useFamilyId } from "../calendar/hooks/useFamilyId";

interface ActivitySummaryState {
  isLoading: boolean;
  summary: ActiveActivitySummary | null;
}

// Sprint 33 ("Siden sidst du var her"): henter aktivitet siden brugerens
// sidste besøg, hentes asynkront ligesom WeeklySummaryCard (ingen
// blokerende spinner på resten af forsiden). `summary` er bevidst kun
// sat, når der REELT er noget at vise (server-cursoren rykker sig selv
// automatisk, hvis der intet er sket, se activity.ts) — kortet skal ikke
// vises "tomt".
export function useActivitySummary() {
  const familyId = useFamilyId();
  const [state, setState] = useState<ActivitySummaryState>({ isLoading: true, summary: null });

  useEffect(() => {
    if (!familyId) {
      return;
    }

    let isCancelled = false;

    getActivitySince(familyId).then((result) => {
      if (isCancelled) {
        return;
      }

      setState({
        isLoading: false,
        summary: result.ok && result.data.hasActivity ? result.data : null,
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [familyId]);

  // Kaldes når kortet lukkes (uanset om det sker direkte, eller efter
  // "Vis alt" er set færdig) — sender det PRÆCISE asOf-tidspunkt, klienten
  // selv fik, tilbage til serveren, så cursoren aldrig utilsigtet springer
  // over aktivitet, brugeren ikke nåede at se (se activity.ts's
  // idempotens-håndtering).
  const acknowledge = useCallback(() => {
    if (!familyId || !state.summary) {
      return;
    }

    void acknowledgeActivity(familyId, state.summary.asOf);
    setState({ isLoading: false, summary: null });
  }, [familyId, state.summary]);

  return { isLoading: state.isLoading, summary: state.summary, acknowledge };
}
