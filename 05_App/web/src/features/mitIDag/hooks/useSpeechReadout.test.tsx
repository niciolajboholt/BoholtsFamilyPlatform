// @vitest-environment jsdom
import { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSpeechReadout } from "./useSpeechReadout";

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

class FakeSpeechSynthesisUtterance {
  text: string;
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

function installFakeSpeechSynthesis(voices: { lang: string }[] = []) {
  const speak = vi.fn((utterance: FakeSpeechSynthesisUtterance) => {
    utterance.onstart?.();
  });
  const cancel = vi.fn();
  const getVoices = vi.fn(() => voices as unknown as SpeechSynthesisVoice[]);

  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: { speak, cancel, getVoices },
  });
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    configurable: true,
    writable: true,
    value: FakeSpeechSynthesisUtterance,
  });

  return { speak, cancel, getVoices };
}

function renderHook<T>(useHook: () => T) {
  let latest: T | undefined;
  const container = document.createElement("div");
  const root = createRoot(container);

  function Harness() {
    latest = useHook();
    return null;
  }

  return {
    render: async () => {
      await act(async () => {
        root.render(
          <StrictMode>
            <Harness />
          </StrictMode>,
        );
      });
    },
    unmount: async () => act(async () => root.unmount()),
    get value() {
      return latest as T;
    },
  };
}

describe("useSpeechReadout", () => {
  afterEach(() => {
    // @ts-expect-error -- fjerner den fake, så tests ikke lækker mellem hinanden.
    delete window.speechSynthesis;
  });

  it("reports unsupported when the browser has no speechSynthesis", async () => {
    // @ts-expect-error -- simulerer en browser uden Web Speech API.
    delete window.speechSynthesis;

    const harness = renderHook(useSpeechReadout);
    await harness.render();

    expect(harness.value.isSupported).toBe(false);
    await harness.unmount();
  });

  it("prefers a Danish voice when one is available", async () => {
    const { speak } = installFakeSpeechSynthesis([{ lang: "en-US" }, { lang: "da-DK" }]);

    const harness = renderHook(useSpeechReadout);
    await harness.render();

    act(() => harness.value.speak("Hej Frida!"));

    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as FakeSpeechSynthesisUtterance;
    expect(utterance.text).toBe("Hej Frida!");
    expect(utterance.lang).toBe("da-DK");

    await harness.unmount();
  });

  it("falls back to da-DK as a language hint when no Danish voice exists", async () => {
    const { speak } = installFakeSpeechSynthesis([{ lang: "en-US" }]);

    const harness = renderHook(useSpeechReadout);
    await harness.render();

    act(() => harness.value.speak("Hej!"));

    const utterance = speak.mock.calls[0][0] as FakeSpeechSynthesisUtterance;
    expect(utterance.lang).toBe("da-DK");

    await harness.unmount();
  });

  it("does nothing for empty or whitespace-only text", async () => {
    const { speak } = installFakeSpeechSynthesis();

    const harness = renderHook(useSpeechReadout);
    await harness.render();

    act(() => harness.value.speak("   "));

    expect(speak).not.toHaveBeenCalled();

    await harness.unmount();
  });

  it("stop() cancels an in-progress utterance and clears isSpeaking", async () => {
    const { cancel } = installFakeSpeechSynthesis([{ lang: "da-DK" }]);

    const harness = renderHook(useSpeechReadout);
    await harness.render();

    act(() => harness.value.speak("Hej!"));
    expect(harness.value.isSpeaking).toBe(true);

    act(() => harness.value.stop());

    expect(cancel).toHaveBeenCalled();
    expect(harness.value.isSpeaking).toBe(false);

    await harness.unmount();
  });

  it("cancels speech synthesis on unmount", async () => {
    const { cancel } = installFakeSpeechSynthesis([{ lang: "da-DK" }]);

    const harness = renderHook(useSpeechReadout);
    await harness.render();
    act(() => harness.value.speak("Hej!"));

    await harness.unmount();

    expect(cancel).toHaveBeenCalled();
  });

  it("speak() cancels any previous utterance before starting a new one ('læs op igen')", async () => {
    const { speak, cancel } = installFakeSpeechSynthesis([{ lang: "da-DK" }]);
    const harness = renderHook(useSpeechReadout);
    await harness.render();

    act(() => harness.value.speak("Først"));
    cancel.mockClear();
    act(() => harness.value.speak("Så"));

    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(2);

    await harness.unmount();
  });
});
