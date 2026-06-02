import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'error' | 'info' | 'success';
  undoAction?: () => void;
}

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function ToastStack({ toasts, onDismiss }: Props) {
  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const bg =
    toast.type === 'error' ? 'bg-[#F69C9C]/20 border-[#F69C9C]/40 text-[#c0504a]' :
    toast.type === 'success' ? 'bg-[#20dfb9]/10 border-[#20dfb9]/30 text-[#006b57]' :
    'bg-white border-[#e0e0e0] text-[#4A4A4A]';

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-full border shadow-[0_8px_24px_rgba(74,74,74,0.1)] font-body text-sm font-semibold transition-all duration-300 ${bg} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <span>{toast.text}</span>
      {toast.undoAction && (
        <button
          onClick={() => { toast.undoAction!(); onDismiss(toast.id); }}
          className="ml-1 font-bold underline underline-offset-2 hover:opacity-70 transition-opacity"
        >
          Undo
        </button>
      )}
    </div>
  );
}

// Hook for managing toasts
import { useCallback, useRef } from 'react';
import { newId } from '../../lib/ids';

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const dismissRef = useRef<(id: string) => void>(() => {});

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  dismissRef.current = dismiss;

  const showToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = newId();
    setToasts(prev => [...prev, { ...msg, id }]);
  }, []);

  return { toasts, showToast, dismiss };
}
