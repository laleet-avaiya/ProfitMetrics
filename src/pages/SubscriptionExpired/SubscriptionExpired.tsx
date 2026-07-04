import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { SupportContactLinks } from '../../components/SupportContact/SupportContactLinks';
import { Button } from '../../components/Button/Button';
import { isOrgSubscriptionExpired } from '../../utils/subscription';
import { CreditCard, LogOut, RefreshCw } from 'lucide-react';

export function SubscriptionExpired() {
  const { signOut, org, accessibleOrgs } = useAuth();

  const hasOtherActiveOrg = accessibleOrgs.some(
    (entry) => entry.org.id !== org?.id && !isOrgSubscriptionExpired(entry.org)
  );
  const hasOtherOrgs = accessibleOrgs.length > 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex p-4 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
          <CreditCard className="w-12 h-12 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          Subscription expired
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          {org?.name ? (
            <>
              The subscription for <strong>{org.name}</strong> has ended.
            </>
          ) : (
            'This organization\'s subscription has ended.'
          )}{' '}
          {hasOtherActiveOrg
            ? 'You can switch to another organization with an active subscription, or contact support to renew this one.'
            : 'Please contact your organization admin or support to renew and continue using the app.'}
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm text-left mb-8">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
            Contact to renew
          </h2>
          <SupportContactLinks layout="stack" />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {hasOtherActiveOrg || hasOtherOrgs ? (
            <Link
              to="/companies"
              state={{ preferActiveOrg: hasOtherActiveOrg }}
              className="w-full sm:w-auto"
            >
              <Button variant="primary" className="w-full sm:w-auto">
                <RefreshCw className="w-4 h-4 mr-2" />
                {hasOtherActiveOrg ? 'Switch organization' : 'Choose organization'}
              </Button>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
