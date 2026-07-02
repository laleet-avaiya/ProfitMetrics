import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { Button } from '../../components/Button/Button';
import { FormActions } from '../../components/FormActions/FormActions';
import { BRAND_LOGO_FULL, BRAND_NAME } from '../../constants/brand';
import {
  BusinessCountry,
  COUNTRY_OPTIONS,
  getCountryProfile,
} from '../../constants/countries';
import { OrgRole } from '../../models/org';

export function CreateCompanyPage() {
  const navigate = useNavigate();
  const { createCompany, org, orgMembership } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState<BusinessCountry>(BusinessCountry.INDIA);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const countryProfile = useMemo(() => getCountryProfile(country), [country]);
  const isOrgAdmin = orgMembership?.role === OrgRole.ADMIN;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createCompany({ companyName, country });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  if (!isOrgAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
        <p className="text-gray-600 dark:text-gray-400 mb-4">Only organization admins can create companies.</p>
        <Link to="/companies" className="text-indigo-600 dark:text-indigo-400 hover:underline">
          Back to companies
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-4">
          <Link
            to="/companies"
            className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <img src={BRAND_LOGO_FULL} alt={BRAND_NAME} className="h-8 w-auto ml-auto" />
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="max-w-xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Add company</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Create a company under {org?.name ?? 'your organization'}.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              label="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              placeholder="Your company name"
            />
            <Select
              label="Business country"
              value={country}
              onChange={(e) => setCountry(e.target.value as BusinessCountry)}
              options={COUNTRY_OPTIONS}
              required
            />
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-3 text-sm text-gray-600 dark:text-gray-400">
              Currency: {countryProfile.currencyLabel} · Default tax:{' '}
              {countryProfile.defaultTaxType.toUpperCase()}
            </div>
            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            <FormActions>
              <Button type="submit" variant="primary" loading={loading}>
                Create company
              </Button>
            </FormActions>
          </form>
        </div>
      </main>
    </div>
  );
}
