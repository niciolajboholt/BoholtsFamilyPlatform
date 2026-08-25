import { useEffect, useState } from "react";

import { getMyFamily } from "../../family/familyApi";

// Kalenderen selv har ellers ingen grund til at kende familie-id'et (alle
// kalenderoperationer går gennem provider-abstraktionen, scopet af
// sessionen alene) — kun aftale-påmindelser (Sprint 31) er familie-delt
// data og har derfor brug for det, ligesom indkøbslisten.
export function useFamilyId(): string | null {
  const [familyId, setFamilyId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    getMyFamily().then((result) => {
      if (!isCancelled && result.ok && result.data.family) {
        setFamilyId(result.data.family.id);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  return familyId;
}
