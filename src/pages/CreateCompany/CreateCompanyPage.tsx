import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { Button } from '../../components/Button/Button';
import { FormActions } from '../../components/FormActions/FormActions';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import {
  BusinessCountry,
  COUNTRY_OPTIONS,
  getCountryProfile,
} from '../../constants/countries';

export function CreateCompanyPage() {
  const navigate = useNavigate();
  const { setupCompany } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState<BusinessCountry>(BusinessCountry.INDIA);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const countryProfile = useMemo(() => getCountryProfile(country), [country]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await setupCompany({ companyName, country });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title="Create your company"
          description="Set up a new company workspace for your business."
        />
        <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
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
            Currency: {countryProfile.currencyLabel} · Default tax: {countryProfile.defaultTaxType.toUpperCase()}
          </div>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <FormActions>
            <Button type="submit" variant="primary" loading={loading}>
              Create company
            </Button>
          </FormActions>
        </form>
      </PageShell>
    </Layout>
  );
}
