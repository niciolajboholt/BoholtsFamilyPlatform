import { useEffect, useState } from "react";

import { clearAllFamilyStorage } from "../../calendar/preferences/dataBackupStorage";
import { clearCurrentMemberId } from "../../calendar/preferences/currentMemberStorage";
import { disablePushNotifications } from "../../notifications/pushSubscription";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
}

interface MeResponse {
  user: SessionUser;
}

interface UseSessionResult {
  user: SessionUser | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

/**
 * Serverens session (Fase 1) — erstatter ikke noget eksisterende, det er den
 * første login-gate appen nogensinde har haft. `/api/me` svarer 401 uden en
 * gyldig session-cookie, hvilket her blot betyder "ikke logget ind", ikke en
 * fejl der skal vises til brugeren.
 */
export function useSession(): UseSessionResult {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    fetch("/api/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        const data: MeResponse = await response.json();
        return data.user;
      })
      .catch(() => null)
      .then((sessionUser) => {
        if (!isCancelled) {
          setUser(sessionUser);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Sprint 29: en ekstern gennemgang fandt, at logout hidtil kun ryddede
  // familiemedlemmer/"Min profil" — Google-eventcache, kalender-mappings,
  // synlighed, ekskluderinger, gentagelsesundtagelser, Outlook/MSAL-
  // sessionen og enhedens push-abonnement overlevede alle et logout. En
  // anden bruger, der logger ind på samme enhed bagefter, kunne dermed
  // arve den forrige brugers data — og enheden kunne blive ved med at
  // modtage push om den forrige families kalender/opgaver/indkøbsliste.
  async function logout(): Promise<void> {
    await fetch("/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });

    clearAllFamilyStorage();
    clearCurrentMemberId();

    await disablePushNotifications().catch((error: unknown) => {
      console.error("Kunne ikke afmelde push-abonnementet ved logout:", error);
    });

    // Dynamisk import: calendarProviderFactory (Outlook/MSAL + Google) er
    // sit eget lazy-loadede chunk (kun hentet fra Kalender-/Indstillinger-
    // siderne) — et statisk import her ville trække det ind i appens
    // hovedbundle for enhver bruger, blot fordi useSession bruges overalt.
    const { outlookCalendarSession } = await import(
      "../../calendar/providers/calendarProviderFactory"
    );
    await outlookCalendarSession.disconnect();

    setUser(null);

    // useSession() gemmer sin egen user-tilstand lokalt pr. komponent (ingen
    // delt context) — uden en genindlæsning ville kun DENNE komponents
    // instans opdage logout, mens fx AppLayout's egen useSession()-kald
    // fortsat viser den fulde, loggede-ind app-skal. Samme "reload er den
    // simple, pålidelige måde at få al state til at læse den nye tilstand
    // igen"-tilgang som backup-importen bruger (AccountDataSection.tsx).
    window.location.reload();
  }

  return { user, isLoading, logout };
}
