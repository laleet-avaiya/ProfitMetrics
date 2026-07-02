import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../Layout/Layout';
import { PageHeader, PageShell } from '../PageShell/PageShell';
import { Button } from '../Button/Button';
import { LoadingView } from '../AppLoader/AppLoader';

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
  meta?: ReactNode;
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
  meta,
  actions,
  children,
}: EntityDetailShellProps) {
  if (loading) {
    return (
      <Layout>
        <PageShell>
          <LoadingView message={loadingLabel} size="xl" className="py-20" />
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
