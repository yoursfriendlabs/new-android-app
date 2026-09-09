import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { Snackbar } from '@/src/shared/feedback/Snackbar';
import { haptics } from '@/src/shared/lib/haptics';

export type ToastTone = 'success' | 'danger' | 'info';

interface ToastOptions {
  tone?: ToastTone;
  duration?: number;
  /** Set false to skip the vibration for chatty, low-stakes messages. */
  haptic?: boolean;
}

interface ToastApi {
  show: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  hide: () => void;
}

interface ToastState {
  message: string;
  tone: ToastTone;
  duration: number;
  visible: boolean;
  key: number;
}

const ToastContext = createContext<ToastApi | null>(null);

let imperativeToast: ToastApi | null = null;

/**
 * Toast for code that cannot use the hook (api client, stores, sync).
 * Inside components use `useToast()` instead.
 */
export const toast: ToastApi = {
  error: (message, options) => imperativeToast?.error(message, options),
  hide: () => imperativeToast?.hide(),
  info: (message, options) => imperativeToast?.info(message, options),
  show: (message, options) => imperativeToast?.show(message, options),
  success: (message, options) => imperativeToast?.success(message, options),
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<ToastState>({
    duration: 3000,
    key: 0,
    message: '',
    tone: 'success',
    visible: false,
  });

  const show = useCallback((message: string, options: ToastOptions = {}) => {
    const tone = options.tone ?? 'success';
    if (options.haptic !== false) {
      if (tone === 'success') haptics.success();
      else if (tone === 'danger') haptics.error();
      else haptics.tapLight();
    }
    setState((current) => ({
      duration: options.duration ?? 3000,
      key: current.key + 1,
      message,
      tone,
      visible: true,
    }));
  }, []);

  const api = useMemo<ToastApi>(() => {
    const value: ToastApi = {
      error: (message, options) => show(message, { ...options, tone: 'danger' }),
      hide: () => setState((current) => ({ ...current, visible: false })),
      info: (message, options) => show(message, { ...options, tone: 'info' }),
      show,
      success: (message, options) => show(message, { ...options, tone: 'success' }),
    };
    imperativeToast = value;
    return value;
  }, [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        key={state.key}
        visible={state.visible}
        message={state.message}
        tone={state.tone}
        duration={state.duration}
        onDismiss={api.hide}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return context;
}
