import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, CreditCard, LogOut, Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/Button/Button';
import { BRAND_LOGO_FULL, BRAND_NAME } from '../../constants/brand';
import { OrgRole } from '../../models/org';
import { formatDate } from '../../utils/date';
import { getSubscriptionDaysRemaining, shouldShowSubscriptionRenewalNotice } from '../../utils/subscription';

export function CompaniesPage() {
  const navigate = useNavigate();
  const { org, orgMembership, userCompanies, selectCompany, signOut, loading } = useAuth();

  const daysLeft = org?.subscriptionEnd != null ? getSubscriptionDaysRemaining(org.subscriptionEnd) : null;
  const isExpired = daysLeft !== null && daysLeft <= 0;
  const showSubscriptionNotice = shouldShowSubscriptionRenewalNotice(daysLeft);
  const canAddCompany =
    orgMembership?.role === OrgRole.ADMIN &&
    org != null &&
    userCompanies.length < org.companyQuota;

  const sortedCompanies = useMemo(
    () => [...userCompanies].sort((a, b) => a.name.localeCompare(b.name)),
    [userCompanies]
  );

  const handleSelect = async (companyId: string) => {
    await selectCompany(companyId);
    navigate('/', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <img src={BRAND_LOGO_FULL} alt={BRAND_NAME} className="h-10 w-auto" />
          <button
            type="button"
            onClick={() => signOut().catch(console.error)}
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Your companies</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {org?.name ? (
                <>Organization: <strong className="text-gray-900 dark:text-white">{org.name}</strong></>
              ) : (
                'Select a company to continue, or create a new one.'
              )}
            </p>
          </div>

          {org?.subscriptionEnd != null && showSubscriptionNotice && (
            <div
              className={`rounded-xl border px-4 py-3 flex items-start gap-3 text-sm ${
                isExpired
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                  : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
              }`}
            >
              <CreditCard className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  {isExpired
                    ? 'Organization subscription expired'
                    : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left on subscription`}
                </p>
                <p className="mt-0.5 opacity-90">
                  Valid until {formatDate(org.subscriptionEnd)}
                  {orgMembership?.role === OrgRole.ADMIN ? (
                    <>
                      {' · '}
                      <Link to="/subscription" className="underline hover:no-underline">
                        Manage subscription
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          )}

          {sortedCompanies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-8 text-center">
              <Building2 className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">No companies yet</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {canAddCompany
                  ? 'Create your first company to start tracking profit metrics.'
                  : 'Ask your organization admin to add you to a company, or wait for an invite.'}
              </p>
              {canAddCompany ? (
                <Link to="/companies/new" className="inline-block mt-4">
                  <Button variant="primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Add company
                  </Button>
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedCompanies.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id).catch(console.error)}
                  className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{item.country}</p>
                    </div>
                  </div>
                </button>
              ))}

              {canAddCompany ? (
                <Link
                  to="/companies/new"
                  className="flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 p-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add company
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
