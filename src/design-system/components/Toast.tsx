'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Icon, { type IconName } from '@/design-system/components/Icon';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  duration?: number;
};

const ICONS: Record<ToastTone, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'alert',
  error: 'alert',
};

type ToastContextValue = {
  toast: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: Omit<Toast, 'id'>) => {
      counter.current += 1;
      const id = `sv-toast-${counter.current}`;
      setToasts((prev) => [...prev, { ...input, id }]);

      const duration = input.duration ?? 4500;
      if (duration > 0) setTimeout(() => dismiss(id), duration);

      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="sv-toast-viewport" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((item) => (
          <div key={item.id} className={`sv-toast sv-toast--${item.tone}`}>
            <span className="sv-toast__icon">
              <Icon name={ICONS[item.tone]} size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sv-toast__title">{item.title}</div>
              {item.description && <p className="sv-toast__description">{item.description}</p>}
            </div>
            <button
              type="button"
              className="sv-toast__close"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
