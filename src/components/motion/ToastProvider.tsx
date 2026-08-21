'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toastIn, toastOut } from '@/lib/motion/presets';

export type CxToastTone = 'success' | 'error' | 'info' | 'wallet';

export type CxToast = {
  id: number;
  tone: CxToastTone;
  title: string;
  description?: string;
  /** 0 = persistant (l'utilisateur ferme lui-même). */
  duration?: number;
};

const ICON: Record<CxToastTone, string> = {
  success: 'ion-checkmark-circled',
  error: 'ion-alert-circled',
  info: 'ion-information-circled',
  wallet: 'ion-card',
};

type ContextValue = {
  toast: (input: Omit<CxToast, 'id'>) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ContextValue | null>(null);

/**
 * Notifications côté client.
 *
 * Séparé du `ToastProvider` du design system (réservé à
 * l'administration) : les deux espaces n'ont ni la même palette ni le
 * même placement — en bas sur mobile, à portée du pouce.
 */
export function CxToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<CxToast[]>([]);
  const counter = useRef(0);
  const nodes = useRef(new Map<number, HTMLDivElement>());

  const remove = useCallback((id: number) => {
    nodes.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /** Sortie animée, puis retrait du DOM. */
  const dismiss = useCallback(
    (id: number) => {
      const node = nodes.current.get(id);
      if (!node) return remove(id);
      toastOut(node, () => remove(id));
    },
    [remove]
  );

  const toast = useCallback(
    (input: Omit<CxToast, 'id'>) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((prev) => [...prev, { ...input, id }]);
      return id;
    },
    []
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="cx-toasts" role="region" aria-live="polite">
        {toasts.map((item) => (
          <ToastItem key={item.id} toast={item} onDismiss={dismiss} register={nodes.current} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
  register,
}: {
  toast: CxToast;
  onDismiss: (id: number) => void;
  register: Map<number, HTMLDivElement>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    register.set(toast.id, node);
    toastIn(node);

    const ms = toast.duration ?? 4200;
    if (ms <= 0) return;

    const timer = window.setTimeout(() => onDismiss(toast.id), ms);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  return (
    <div ref={ref} className={`cx-toast cx-toast--${toast.tone}`} role="status">
      <span className="cx-toast__icon">
        <i className={ICON[toast.tone]} />
      </span>
      <div className="cx-toast__body">
        <strong>{toast.title}</strong>
        {toast.description && <span>{toast.description}</span>}
      </div>
      <button
        type="button"
        className="cx-toast__close"
        aria-label="Fermer"
        onClick={() => onDismiss(toast.id)}
      >
        <i className="ion-close" />
      </button>
    </div>
  );
}

export function useCxToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useCxToast doit être utilisé dans <CxToastProvider>');
  return ctx;
}
