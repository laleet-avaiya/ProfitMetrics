export type AppLoaderSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<AppLoaderSize, string> = {
  xs: 'h-3.5 w-3.5 border-[1.5px]',
  sm: 'h-5 w-5 border-2',
  md: 'h-7 w-7 border-2',
  lg: 'h-8 w-8 border-2',
  xl: 'h-12 w-12 border-[3px]',
};

interface AppLoaderProps {
  size?: AppLoaderSize;
  className?: string;
  label?: string;
}

/** Circular spinner — use for all loading indicators. */
export function AppLoader({ size = 'md', className = '', label = 'Loading' }: AppLoaderProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-400 shrink-0 ${sizeClasses[size]} ${className}`.trim()}
    />
  );
}

interface LoadingViewProps {
  message?: string;
  size?: AppLoaderSize;
  className?: string;
}

/** Centered loader with optional message — page sections, full views, auth gates. */
export function LoadingView({ message, size = 'lg', className = '' }: LoadingViewProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-center ${className}`.trim()}>
      <AppLoader size={size} />
      {message ? <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p> : null}
    </div>
  );
}
