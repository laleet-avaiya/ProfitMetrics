import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../Layout/Layout';
import { PageHeader, PageShell } from '../PageShell/PageShell';
import { Button } from '../Button/Button';
import { Package } from 'lucide-react';

interface EntityDetailShellProps {
  loading: boolean;
  loadingLabel?: string;
  loadingIcon?: LucideIcon;
  notFound: boolean;
  notFoundTitle: string;
  notFoundDescription: string;
  backTo: string;
  backLabel: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function EntityDetailShell({
  loading,
  loadingLabel = 'Loading…',
  loadingIcon: LoadingIcon = Package,
  notFound,
  notFoundTitle,
  notFoundDescription,
  backTo,
  backLabel,
  title,
  description,
  meta,
  actions,
  children,
}: EntityDetailShellProps) {
  if (loading) {
    return (
      <Layout>
        <PageShell>
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <LoadingIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{loadingLabel}</p>
          </div>
        </PageShell>
      </Layout>
    );
  }

  if (notFound) {
    return (
      <Layout>
        <PageShell>
          <PageHeader title={notFoundTitle} description={notFoundDescription} />
          <Link to={backTo}>
            <Button type="button" variant="outline">
              {backLabel}
            </Button>
          </Link>
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell>
        <div className="space-y-3">
          <PageHeader title={title} description={description} actions={actions} />
          {meta ? <div className="-mt-1">{meta}</div> : null}
        </div>
        <div className="w-full space-y-5 mt-1">{children}</div>
      </PageShell>
    </Layout>
  );
}
