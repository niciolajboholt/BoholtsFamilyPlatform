import { useEffect, useState } from "react";

import { clearCurrentMemberId } from "../../calendar/preferences/currentMemberStorage";
import { clearFamilyMembers } from "../../calendar/preferences/familyMembersStorage";

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

  async function logout(): Promise<void> {
    await fetch("/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });

    // En anden bruger kan logge ind på samme enhed bagefter — uden dette
    // ville de arve denne brugers familie fra den lokale cache, fordi
    // hasCompletedFamilySetup() stadig ville være sand.
    clearFamilyMembers();
    clearCurrentMemberId();
    setUser(null);
  }

  return { user, isLoading, logout };
}
