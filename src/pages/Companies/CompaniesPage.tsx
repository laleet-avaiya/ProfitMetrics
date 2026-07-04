import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Building2, CreditCard, LogOut, Plus, Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { LoadingView } from '../../components/AppLoader/AppLoader';
import { Button } from '../../components/Button/Button';
import { Select } from '../../components/Select/Select';
import { BRAND_LOGO_FULL, BRAND_NAME } from '../../constants/brand';
import { OrgRole } from '../../models/org';
import { formatDate } from '../../utils/date';
import { getSubscriptionDaysRemaining, isOrgSubscriptionExpired, shouldShowSubscriptionRenewalNotice } from '../../utils/subscription';

export function CompaniesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    org,
    orgMembership,
    profile,
    userCompanies,
    accessibleOrgs,
    selectCompany,
    selectOrg,
    signOut,
    loading,
    refreshCompanies,
    createOwnOrganization,
  } = useAuth();
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);
  const [refreshingCompanies, setRefreshingCompanies] = useState(false);
  const [startingOwnOrg, setStartingOwnOrg] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startOrgError, setStartOrgError] = useState<string | null>(null);
  const [switchOrgError, setSwitchOrgError] = useState<string | null>(null);
  const [openCompanyError, setOpenCompanyError] = useState<string | null>(null);

  const daysLeft = org?.subscriptionEnd != null ? getSubscriptionDaysRemaining(org.subscriptionEnd) : null;
  const isExpired = org != null && isOrgSubscriptionExpired(org);
  const showSubscriptionNotice =
    org?.subscriptionEnd != null && shouldShowSubscriptionRenewalNotice(daysLeft);
  const hasOtherActiveOrg = accessibleOrgs.some(
    (entry) => entry.org.id !== org?.id && !isOrgSubscriptionExpired(entry.org)
  );
  const isLoadingCompanies = loading || refreshingCompanies || switchingOrgId !== null;
  const isOrgAdmin = orgMembership?.role === OrgRole.ADMIN;
  const ownsAnOrg = accessibleOrgs.some((entry) => entry.org.ownerId === user?.uid);
  const companiesInActiveOrg = useMemo(
    () => (org ? userCompanies.filter((c) => c.orgId === org.id) : []),
    [org, userCompanies]
  );
  const canAddCompany =
    !isLoadingCompanies &&
    !isExpired &&
    isOrgAdmin &&
    org != null &&
    companiesInActiveOrg.length < org.companyQuota;
  const canStartOwnOrg = !isLoadingCompanies && !startingOwnOrg && !ownsAnOrg;

  const sortedCompanies = useMemo(
    () => [...companiesInActiveOrg].sort((a, b) => a.name.localeCompare(b.name)),
    [companiesInActiveOrg]
  );

  const orgSelectOptions = useMemo(
    () =>
      accessibleOrgs.map(({ org: orgOption, membership, companyCount }) => {
        const isOwnOrg = orgOption.ownerId === user?.uid;
        const expired = isOrgSubscriptionExpired(orgOption);
        const parts = [
          isOwnOrg ? 'Yours' : 'Shared',
          membership.role === OrgRole.ADMIN ? 'Admin' : null,
          expired ? 'Expired' : null,
          `${companyCount} ${companyCount === 1 ? 'company' : 'companies'}`,
        ].filter(Boolean);
        return {
          value: orgOption.id,
          label: `${orgOption.name} · ${parts.join(' · ')}`,
        };
      }),
    [accessibleOrgs, user?.uid]
  );

  const refreshCompaniesRef = useRef(refreshCompanies);
  refreshCompaniesRef.current = refreshCompanies;
  const orgRepairAttemptedRef = useRef(false);
  const preferActiveOrgHandledRef = useRef(false);
  const emptyCompaniesRefreshRef = useRef(false);

  // Recover if auth finished before invite membership was visible (e.g. race on first signup).
  useEffect(() => {
    if (
      loading ||
      emptyCompaniesRefreshRef.current ||
      !user ||
      userCompanies.length > 0
    ) {
      return;
    }
    emptyCompaniesRefreshRef.current = true;
    void refreshCompaniesRef.current().catch((err) => {
      console.error(err);
      emptyCompaniesRefreshRef.current = false;
    });
  }, [loading, user, userCompanies.length]);

  // From subscription-expired: auto-select first org with an active subscription.
  useEffect(() => {
    const preferActiveOrg =
      (location.state as { preferActiveOrg?: boolean } | null)?.preferActiveOrg === true;
    if (
      !preferActiveOrg ||
      preferActiveOrgHandledRef.current ||
      loading ||
      switchingOrgId ||
      accessibleOrgs.length === 0
    ) {
      return;
    }

    const validOrg = accessibleOrgs.find((entry) => !isOrgSubscriptionExpired(entry.org));
    if (!validOrg || validOrg.org.id === org?.id) {
      preferActiveOrgHandledRef.current = true;
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    preferActiveOrgHandledRef.current = true;
    void handleSelectOrg(validOrg.org.id).finally(() => {
      navigate(location.pathname, { replace: true, state: {} });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when arriving from subscription-expired
  }, [loading, accessibleOrgs, org?.id, switchingOrgId, location.pathname, location.state]);

  // Session load already fetches companies; repair org context once if it failed during sign-in.
  useEffect(() => {
    if (loading || org || userCompanies.length === 0 || orgRepairAttemptedRef.current) return;
    orgRepairAttemptedRef.current = true;
    void refreshCompaniesRef.current().catch((err) => {
      console.error(err);
    });
  }, [loading, org, userCompanies.length]);

  const handleOrgChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const orgId = event.target.value;
    if (!orgId || org?.id === orgId) return;
    void handleSelectOrg(orgId);
  };

  const handleSelectOrg = async (orgId: string) => {
    if (switchingOrgId || org?.id === orgId) return;
    setSwitchOrgError(null);
    setSwitchingOrgId(orgId);
    try {
      await selectOrg(orgId);
    } catch (err) {
      console.error(err);
      setSwitchOrgError(
        err instanceof Error ? err.message : 'Failed to switch organization. Please try again.'
      );
    } finally {
      setSwitchingOrgId(null);
    }
  };

  const handleSelect = async (companyId: string) => {
    if (selectingId || isExpired) return;
    setOpenCompanyError(null);
    setSelectingId(companyId);
    try {
      await selectCompany(companyId);
      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      setOpenCompanyError(
        err instanceof Error ? err.message : 'Could not open this company. Please try again.'
      );
      setSelectingId(null);
    }
  };

  const handleStartOwnOrganization = async () => {
    setStartOrgError(null);
    setStartingOwnOrg(true);
    try {
      await createOwnOrganization(profile?.displayName);
      navigate('/companies/new', { replace: true });
    } catch (err) {
      console.error(err);
      setStartOrgError(
        err instanceof Error ? err.message : 'Failed to create your organization. Please try again.'
      );
    } finally {
      setStartingOwnOrg(false);
    }
  };

  const activeOrgLabel = org
    ? org.ownerId === user?.uid
      ? 'Your organization'
      : 'Shared with you'
    : null;
  const showOrgDropdown = !isLoadingCompanies && accessibleOrgs.length > 0;

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
              {isLoadingCompanies ? (
                'Loading your organizations and companies…'
              ) : showOrgDropdown ? (
                <>
                  Choose an organization to see its companies.
                  {!isOrgAdmin && org ? (
                    <span className="block mt-0.5 text-xs text-gray-500 dark:text-gray-500">
                      You were invited to this organization. Open a shared company below, or switch
                      using the dropdown.
                    </span>
                  ) : null}
                </>
              ) : (
                'Select an organization and company to continue.'
              )}
            </p>
          </div>

          {showOrgDropdown ? (
            <Select
              id="active-org"
              label="Organization"
              value={org?.id ?? ''}
              options={orgSelectOptions}
              onChange={handleOrgChange}
              disabled={isLoadingCompanies || switchingOrgId !== null}
              error={switchOrgError ?? undefined}
              helperText={
                switchingOrgId
                  ? 'Switching organization…'
                  : activeOrgLabel
                    ? `${activeOrgLabel}${accessibleOrgs.length > 1 ? ' — use the dropdown to switch' : ''}`
                    : undefined
              }
            />
          ) : null}

          {!isLoadingCompanies && org?.subscriptionEnd != null && showSubscriptionNotice && (
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
                  {isExpired && hasOtherActiveOrg ? (
                    <span className="block mt-1">
                      Switch to another organization above to access its companies.
                    </span>
                  ) : null}
                  {isOrgAdmin && !isExpired ? (
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

          {loadError ? (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200">
              <p>{loadError}</p>
              <button
                type="button"
                className="mt-2 font-medium underline hover:no-underline"
                onClick={() => {
                  setLoadError(null);
                  setRefreshingCompanies(true);
                  refreshCompanies()
                    .then((count) => {
                      if (count === 0) {
                        setLoadError('Could not load your companies. Please try again.');
                      }
                    })
                    .catch((err) => {
                      console.error(err);
                      setLoadError('Could not load your companies. Please try again.');
                    })
                    .finally(() => setRefreshingCompanies(false));
                }}
              >
                Retry
              </button>
            </div>
          ) : null}

          {isLoadingCompanies ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-12">
              <LoadingView message="Loading companies…" size="lg" className="gap-4" />
            </div>
          ) : !org ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-8 text-center">
              <Building2 className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">Select an organization</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Choose one of your organizations above to see its companies.
              </p>
            </div>
          ) : sortedCompanies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-8 text-center">
              <Building2 className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">No companies in this organization</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {canAddCompany
                  ? 'Create your first company in this organization.'
                  : isOrgAdmin
                    ? 'This organization has reached its company limit.'
                    : 'Ask your organization admin to add you to a company.'}
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
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Companies in {org.name}
              </p>
              {isExpired ? (
                <p className="text-sm text-red-700 dark:text-red-300">
                  Companies in this organization cannot be opened until the subscription is renewed.
                  {hasOtherActiveOrg
                    ? ' Switch to another organization above to continue working.'
                    : ' Contact support to renew.'}
                </p>
              ) : null}
              {openCompanyError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{openCompanyError}</p>
              ) : null}
              {sortedCompanies.map((item) => {
                const isOpening = selectingId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border bg-white dark:bg-gray-800 p-4 transition-all ${
                      isOpening
                        ? 'border-indigo-300 dark:border-indigo-600 ring-1 ring-indigo-500/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{item.country}</p>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        loading={isOpening}
                        disabled={isExpired || (selectingId !== null && !isOpening)}
                        onClick={() => handleSelect(item.id)}
                        className="shrink-0"
                      >
                        {isOpening ? 'Opening…' : isExpired ? 'Unavailable' : 'Open company'}
                      </Button>
                    </div>
                  </div>
                );
              })}

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

          {canStartOwnOrg ? (
            <div className="rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Want your own workspace?
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Create a separate organization with its own trial subscription and add your own
                  companies. You can switch between your organization and shared ones anytime.
                </p>
              </div>
              <Button
                variant="secondary"
                loading={startingOwnOrg}
                onClick={() => void handleStartOwnOrganization()}
                className="w-full sm:w-auto"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Start your own organization
              </Button>
              {startOrgError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{startOrgError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
