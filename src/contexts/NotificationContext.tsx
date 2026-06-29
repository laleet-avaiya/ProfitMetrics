import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { NotificationContext } from './NotificationContextInstance';
import type { Toast as ToastType, ConfirmOptions } from './NotificationContext.types';
import { ToastItem } from '../components/Toast/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog/ConfirmDialog';

function generateId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    options: ConfirmOptions | null;
  }>({ open: false, options: null });

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType['type']) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, type, createdAt: Date.now() }]);
  }, []);

  const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
  const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);
  const info = useCallback((message: string) => addToast(message, 'info'), [addToast]);

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmState({ open: true, options });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState({ open: false, options: null });
  }, []);

  const contextValue = useMemo(
    () => ({ success, error, info, confirm }),
    [success, error, info, confirm]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}

      {/* Toast container - top right, enterprise-style */}
      <div
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-[min(100vw-2rem,24rem)] pointer-events-none"
        aria-live="polite"
      >
        <div className="flex flex-col gap-2 pointer-events-auto">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={confirmState.open}
        options={confirmState.options}
        onClose={closeConfirm}
        onConfirm={() => confirmState.options?.onConfirm()}
      />
    </NotificationContext.Provider>
  );
}
