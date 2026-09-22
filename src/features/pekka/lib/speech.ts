type SpeechModule = typeof import('expo-speech');

let speechModule: SpeechModule | null | undefined;

// Loaded on first use; builds made before expo-speech was added simply stay silent.
function speech(): SpeechModule | null {
  if (speechModule !== undefined) return speechModule;
  try {
    speechModule = require('expo-speech') as SpeechModule;
  } catch {
    speechModule = null;
  }
  return speechModule;
}

/** Reads a Pekka answer aloud, replacing anything still being read. */
export function speakPekka(text: string, lang: string) {
  const native = speech();
  if (!native || !text.trim()) return;
  try {
    native.stop();
    native.speak(text, { language: lang, rate: 0.95 });
  } catch {
    // No voice for this language on the phone: the answer is still on screen.
  }
}

export function stopPekkaSpeech() {
  try {
    speech()?.stop();
  } catch {
    // Nothing was being read.
  }
}
