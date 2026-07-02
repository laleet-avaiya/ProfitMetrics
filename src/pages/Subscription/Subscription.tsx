import { Check } from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { SupportContactLinks } from '../../components/SupportContact/SupportContactLinks';
import { getSubscriptionPricing } from '../../constants/subscriptionPlans';
import { useAuth } from '../../hooks/useAuth';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/profit';
import { getSubscriptionDaysRemaining } from '../../utils/subscription';
import { DEFAULT_AI_MESSAGE_QUOTA } from '../../constants/aiAssistant';

export function Subscription() {
  const { org, company } = useAuth();
  const start = org?.subscriptionStart;
  const end = org?.subscriptionEnd;
  const daysLeft = end != null ? getSubscriptionDaysRemaining(end) : null;
  const isExpired = daysLeft !== null && daysLeft <= 0;
  const pricing = getSubscriptionPricing(company?.country);
  const plan = pricing.plan;
  const aiQuota = org?.aiMessageQuota ?? DEFAULT_AI_MESSAGE_QUOTA;
  const aiUsed = org?.aiMessagesUsed ?? 0;

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title="Subscription"
          description="Your organization plan status, pricing, and renewal options"
        />

        <div className="space-y-6">
          {org?.name ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Organization: <strong className="text-gray-900 dark:text-white">{org.name}</strong>
            </p>
          ) : null}

          {start != null && end != null && (
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                Current plan
              </h2>
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
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Company quota</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">
                    {org?.companyQuota ?? 1} compan{org?.companyQuota === 1 ? 'y' : 'ies'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">AI assistant quota</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">
                    {aiUsed} of {aiQuota} messages used this period
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Trial</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">
                    {pricing.trialDays}-day free trial for new organizations
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Pricing
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{pricing.billingNote}</p>

            <article className="max-w-lg rounded-xl border border-indigo-500/30 dark:border-indigo-400/30 ring-1 ring-indigo-500/10 bg-indigo-50/40 dark:bg-indigo-950/20 p-5 sm:p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{plan.description}</p>
              </div>

              <div className="mb-5">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatMoney(plan.yearlyPrice, pricing.currency)}
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> / year</span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Billed annually · 12 months access</p>
              </div>

              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <Check className="w-4 h-4 shrink-0 text-indigo-500 mt-0.5" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Subscribe or renew
            </h2>
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-4">
              Online checkout is coming soon. To subscribe after trial or renew after expiry, contact support
              with your organization name to pay the annual fee.
            </p>
            <SupportContactLinks />
          </section>
        </div>
      </PageShell>
    </Layout>
  );
}
