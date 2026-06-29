import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { pageDescriptionClass, pageShellClass, pageTitleClass } from '../../constants/ui';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Defaults to true on all routes except Dashboard (`/`) */
  showBack?: boolean;
}

export function PageHeader({ title, description, actions, showBack }: PageHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname === '/';
  const backVisible = showBack ?? !isDashboard;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="space-y-2">
      {backVisible && (
        <button
          type="button"
          onClick={handleBack}
          className="hidden lg:inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors -ml-1 px-1 py-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          Back
        </button>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className={pageTitleClass}>{title}</h1>
          {description ? <p className={pageDescriptionClass}>{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}

interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return <div className={pageShellClass}>{children}</div>;
}
