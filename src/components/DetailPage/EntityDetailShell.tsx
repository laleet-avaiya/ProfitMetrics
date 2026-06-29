import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../Layout/Layout';
import { PageHeader, PageShell } from '../PageShell/PageShell';
import { Button } from '../Button/Button';

interface EntityDetailShellProps {
  loading: boolean;
  loadingLabel?: string;
  notFound: boolean;
  notFoundTitle: string;
  notFoundDescription: string;
  backTo: string;
  backLabel: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function EntityDetailShell({
  loading,
  loadingLabel = 'Loading…',
  notFound,
  notFoundTitle,
  notFoundDescription,
  backTo,
  backLabel,
  title,
  description,
  actions,
  children,
}: EntityDetailShellProps) {
  if (loading) {
    return (
      <Layout>
        <PageShell>
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{loadingLabel}</p>
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
        <PageHeader title={title} description={description} actions={actions} />
        <div className="space-y-4 max-w-4xl">{children}</div>
      </PageShell>
    </Layout>
  );
}
