import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

type SpeechModule = typeof ExpoSpeechRecognitionModule;

/** No microphone access or native-module loading until the user taps the mic. */
export function usePekkaVoice(open: boolean, onTranscript: (text: string) => void, lang: string) {
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const moduleRef = useRef<SpeechModule | null>(null);
  const subscriptions = useRef<Array<{ remove: () => void }>>([]);
  const generation = useRef(0);
  const active = useRef(false);
  const onText = useRef(onTranscript);
  onText.current = onTranscript;

  const cancel = useCallback(() => {
    generation.current += 1;
    active.current = false;
    subscriptions.current.forEach((subscription) => subscription.remove());
    subscriptions.current = [];
    moduleRef.current?.abort();
    setListening(false);
    setStarting(false);
  }, []);

  useEffect(() => {
    if (!open) cancel();
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') cancel(); });
    return () => { subscription.remove(); cancel(); };
  }, [cancel, open]);

  async function toggle() {
    if (active.current) { moduleRef.current?.stop(); return; }
    if (!open) return;
    cancel();
    const request = generation.current;
    active.current = true;
    setStarting(true);
    setError('');
    setAlternatives([]);
    try {
      const { ExpoSpeechRecognitionModule: speech } = await import('expo-speech-recognition');
      if (request !== generation.current) return;
      moduleRef.current = speech;
      if (!speech.isRecognitionAvailable()) throw new Error('unavailable');
      const permission = await speech.requestPermissionsAsync();
      if (request !== generation.current) return;
      if (!permission.granted) { setError('permission'); cancel(); return; }
      subscriptions.current = [
        speech.addListener('start', () => { setStarting(false); setListening(true); }),
        speech.addListener('result', (event) => {
          const texts = event.results.map((result) => result.transcript.trim()).filter(Boolean);
          if (texts[0]) onText.current(texts[0]);
          if (event.isFinal) setAlternatives([...new Set(texts)].slice(1, 3));
        }),
        speech.addListener('error', (event) => {
          if (event.error !== 'aborted') setError(event.error === 'not-allowed' ? 'permission' : 'unavailable');
          cancel();
        }),
        speech.addListener('end', () => {
          active.current = false;
          setStarting(false);
          setListening(false);
          subscriptions.current.forEach((subscription) => subscription.remove());
          subscriptions.current = [];
        }),
      ];
      speech.start({ lang, interimResults: true, maxAlternatives: 3, continuous: false, recordingOptions: { persist: false } });
    } catch {
      if (request === generation.current) { setError('unavailable'); cancel(); }
    }
  }
  return { listening, starting, error, alternatives, toggle, cancel };
}
