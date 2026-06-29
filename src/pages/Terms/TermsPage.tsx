import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { FileText, ScrollText } from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { useAuth } from '../../hooks/useAuth';
import {
  CURRENT_LEGAL_VERSION,
  LEGAL_LAST_UPDATED,
  TERMS_SECTIONS,
  USAGE_POLICY_SECTIONS,
} from '../../constants/legalTerms';
import { hasLegalConsent } from '../../utils/legalConsent';
import { formatDateLocal } from '../../utils/date';

function LegalSection({
  title,
  sections,
}: {
  title: ReactNode;
  sections: readonly { title: string; body: string }[];
}) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm">
      <h2 className="text-base font-medium text-gray-900 dark:text-white mb-4">{title}</h2>
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{section.title}</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{section.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TermsPage() {
  const { company } = useAuth();
  const accepted = hasLegalConsent(company);

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title="Terms & Usage Policy"
          description={`Version ${CURRENT_LEGAL_VERSION} · Last updated ${LEGAL_LAST_UPDATED}`}
        />

        <div className="space-y-5">
          {accepted ? (
            <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
              Accepted version {company?.termsVersion} on{' '}
              {company?.termsAcceptedAt ? formatDateLocal(company.termsAcceptedAt) : '—'}.
            </div>
          ) : (
            <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/20 px-4 py-3 text-sm text-indigo-900 dark:text-indigo-200">
              <p className="flex items-start gap-2">
                <FileText className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Your company must accept these documents before using the app.{' '}
                  <Link to="/terms/accept" className="font-medium underline hover:no-underline">
                    Accept now
                  </Link>
                </span>
              </p>
            </div>
          )}

          <LegalSection
            title={
              <span className="inline-flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-indigo-500" />
                Terms & Conditions
              </span>
            }
            sections={TERMS_SECTIONS}
          />

          <LegalSection title="Usage Policy" sections={USAGE_POLICY_SECTIONS} />
        </div>
      </PageShell>
    </Layout>
  );
}
