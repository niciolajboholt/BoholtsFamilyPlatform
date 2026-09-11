import { useEffect, useState } from "react";

import type { FeatureKey } from "../familyApi";
import { getEnabledFeatures, getMyFamily, setFeatureEnabled } from "../familyApi";

interface UseEnabledFeaturesResult {
  isLoading: boolean;
  isEnabled: (key: FeatureKey) => boolean;
  // Kun ejer/admin kan rent faktisk ændre — se
  // featureFlags.ts's PUT-rute. Bruges af FeatureFlagsDialog til at vise
  // kontakterne som deaktiverede for et almindeligt medlem, i stedet for
  // at lade dem klikke og først opdage det via en fejlbesked.
  canManage: boolean;
  toggle: (key: FeatureKey, enabled: boolean) => void;
}

// Hver komponent, der kalder useEnabledFeatures(), får sin egen uafhængige
// state — uden dette ville fx AppLayouts nav-punkter ikke opdatere sig,
// før man selv skiftede side eller genindlæste, efter en anden instans
// (FeatureFlagsDialog) havde slået noget til/fra. Samme mønster som
// familyMembersChangedEvent i familyMembersStorage.ts.
const enabledFeaturesChangedEvent = "boholts-enabled-features-changed";

function dispatchEnabledFeaturesChanged(features: FeatureKey[]): void {
  window.dispatchEvent(new CustomEvent<FeatureKey[]>(enabledFeaturesChangedEvent, { detail: features }));
}

// "Flere funktioner" (Indstillinger → Hjælp og feedback): bruges både til
// selve dialogen og til at skjule/vise nav-punkter og sider for de
// funktioner, der kan slås fra. Alt starter slået fra for enhver familie
// (ny som eksisterende) — se 0027_feature_flags.sql's begrundelse.
export function useEnabledFeatures(): UseEnabledFeaturesResult {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [enabled, setEnabled] = useState<Set<FeatureKey>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    getMyFamily().then((familyResult) => {
      if (isCancelled) {
        return;
      }

      if (!familyResult.ok || !familyResult.data.family) {
        setIsLoading(false);
        return;
      }

      const id = familyResult.data.family.id;
      setFamilyId(id);
      setCanManage(familyResult.data.role === "owner" || familyResult.data.role === "admin");

      getEnabledFeatures(id).then((result) => {
        if (!isCancelled) {
          if (result.ok && result.data.features) {
            setEnabled(new Set(result.data.features));
          }
          setIsLoading(false);
        }
      });
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleChanged(event: Event): void {
      const features = (event as CustomEvent<FeatureKey[]>).detail;
      setEnabled(new Set(features));
    }

    window.addEventListener(enabledFeaturesChangedEvent, handleChanged);
    return () => window.removeEventListener(enabledFeaturesChangedEvent, handleChanged);
  }, []);

  function isEnabled(key: FeatureKey): boolean {
    return enabled.has(key);
  }

  // Optimistisk: opdaterer den lokale mængde med det samme, og retter den
  // efter serverens svar (fx hvis kaldet reelt afvises) — samme mønster
  // som toggleChecked i useShoppingList.ts. Andre instanser (fx AppLayouts
  // nav) opdateres via enabledFeaturesChangedEvent, ikke kun denne.
  function toggle(key: FeatureKey, value: boolean): void {
    if (!familyId) {
      return;
    }

    setEnabled((current) => {
      const next = new Set(current);
      if (value) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });

    setFeatureEnabled(familyId, key, value).then((result) => {
      if (result.ok && result.data.features) {
        setEnabled(new Set(result.data.features));
        dispatchEnabledFeaturesChanged(result.data.features);
      }
    });
  }

  return { isLoading, isEnabled, canManage, toggle };
}
