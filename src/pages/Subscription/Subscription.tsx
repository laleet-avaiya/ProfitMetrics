import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { SupportContactLinks } from '../../components/SupportContact/SupportContactLinks';
import { useAuth } from '../../hooks/useAuth';
import { formatDate } from '../../utils/date';
import { getSubscriptionDaysRemaining } from '../../utils/subscription';

export function Subscription() {
  const { company } = useAuth();
  const start = company?.subscriptionStart;
  const end = company?.subscriptionEnd;
  const daysLeft = end != null ? getSubscriptionDaysRemaining(end) : null;
  const isExpired = daysLeft !== null && daysLeft <= 0;

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title="Subscription"
          description="Your plan status and renewal options"
        />

        <div className="space-y-6">
          {start != null && end != null && (
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Current plan</h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Start date</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">{formatDate(start)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">End date</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">{formatDate(end)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Status</dt>
                  <dd>
                    <span
                      className={
                        isExpired
                          ? 'text-red-600 dark:text-red-400 font-medium'
                          : 'text-gray-900 dark:text-white font-medium'
                      }
                    >
                      {isExpired ? 'Expired' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                    </span>
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Need help?</h2>
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-4">
              To renew your subscription, change your plan, or for any billing questions, please contact your company or
              the account administrator.
            </p>
            <SupportContactLinks />
          </section>
        </div>
      </PageShell>
    </Layout>
  );
}
