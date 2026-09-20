import { useEffect, useState } from "react";

// Sprint 55 (Fase D, se 55_Sprint55_Barn_Adgang_UX_Plan.md): dansk
// browser-oplæsning via Web Speech API — INGEN ekstern TTS-tjeneste, kun
// window.speechSynthesis. Kalderen er selv ansvarlig for kun at give
// teksten videre til speak(), som allerede er tilladt/redigeret data
// (fx samme privatlivsredigerede kalenderaftale-titler som resten af
// siden viser) — denne hook kender intet til, hvor teksten kommer fra.
export interface SpeechReadout {
  isSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
}

function pickDanishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang.toLowerCase().startsWith("da")) ?? null;
}

export function useSpeechReadout(): SpeechReadout {
  const isSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Stopper oplæsning ved unmount (sidenavigation, log ud) — en
  // igangværende utterance fortsætter ellers i baggrunden, selv efter
  // siden, teksten kom fra, er væk.
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function speak(text: string): void {
    const trimmed = text.trim();

    if (!isSupported || !trimmed) {
      return;
    }

    // Afbryder en evt. igangværende oplæsning i stedet for at lægge sig i
    // kø bagved — "læs op igen" skal starte forfra med det samme.
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(trimmed);
    const danishVoice = pickDanishVoice();

    if (danishVoice) {
      utterance.voice = danishVoice;
      utterance.lang = danishVoice.lang;
    } else {
      // Intet dansk stemmevalg fundet — sætter sprogkoden alligevel, så
      // browseren har mulighed for selv at vælge en fornuftig standard-
      // udtale i stedet for at antage engelsk.
      utterance.lang = "da-DK";
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  function stop(): void {
    if (isSupported) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
  }

  return { isSupported, isSpeaking, speak, stop };
}
