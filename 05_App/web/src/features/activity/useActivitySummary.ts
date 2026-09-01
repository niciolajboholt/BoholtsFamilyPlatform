import { useCallback, useEffect, useState } from "react";

import {
  acknowledgeActivity,
  getActivitySince,
  type ActiveActivitySummary,
  type EmptyActivitySummary,
} from "../family/familyApi";
import { useFamilyId } from "../calendar/hooks/useFamilyId";

interface ActivitySummaryState {
  isLoading: boolean;
  summary: ActiveActivitySummary | null;
  empty: EmptyActivitySummary | null;
}

// Sprint 33 ("Siden sidst du var her"): henter aktivitet siden brugerens
// sidste besøg, hentes asynkront ligesom WeeklySummaryCard (ingen
// blokerende spinner på resten af forsiden). `summary` sættes kun, når der
// er aktivitet; ellers gemmes serverens tomme svar i `empty`, så kortet kan
// vise, at brugeren er ajour.
export function useActivitySummary() {
  const familyId = useFamilyId();
  const [state, setState] = useState<ActivitySummaryState>({
    isLoading: true,
    summary: null,
    empty: null,
  });

  useEffect(() => {
    if (!familyId) {
      return;
    }

    let isCancelled = false;

    getActivitySince(familyId).then((result) => {
      if (isCancelled) {
        return;
      }

      if (!result.ok) {
        setState({ isLoading: false, summary: null, empty: null });
        return;
      }

      setState(
        result.data.hasActivity
          ? { isLoading: false, summary: result.data, empty: null }
          : { isLoading: false, summary: null, empty: result.data },
      );
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
    setState({
      isLoading: false,
      summary: null,
      empty: { hasActivity: false, since: state.summary.asOf, asOf: state.summary.asOf },
    });
  }, [familyId, state.summary]);

  return {
    isLoading: state.isLoading,
    summary: state.summary,
    empty: state.empty,
    acknowledge,
  };
}
