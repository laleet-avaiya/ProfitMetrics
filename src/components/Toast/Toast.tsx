import { useEffect } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import type { Toast as ToastType } from '../../contexts/NotificationContext.types';

const TOAST_DURATION_MS = 4500;

const typeConfig = {
  success: {
    icon: CheckCircle2,
    className:
      'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
    iconClassName: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    icon: XCircle,
    className:
      'bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    iconClassName: 'text-red-600 dark:text-red-400',
  },
  info: {
    icon: Info,
    className:
      'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    iconClassName: 'text-blue-600 dark:text-blue-400',
  },
};

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

export function ToastItem({ toast, onDismiss }: ToastProps) {
  const config = typeConfig[toast.type];
  const Icon = config.icon;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="alert"
      className={`
        flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg
        animate-slide-down
        ${config.className}
      `}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconClassName}`} />
      <p className="flex-1 text-sm font-medium min-w-0">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-lg opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-1 shrink-0 touch-manipulation"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
