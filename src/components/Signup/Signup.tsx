import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';
import { Button } from '../Button/Button';
import { FormActions } from '../FormActions/FormActions';
import { Eye, EyeOff } from 'lucide-react';
import { BRAND_LOGO_FULL, BRAND_NAME, BRAND_TAGLINE } from '../../constants/brand';
import {
  BusinessCountry,
  COUNTRY_OPTIONS,
  getCountryProfile,
} from '../../constants/countries';

export function Signup() {
  const { signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const invited = searchParams.get('invited') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState<BusinessCountry>(BusinessCountry.INDIA);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const countryProfile = useMemo(() => getCountryProfile(country), [country]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (invited) {
        await signUp(email, password);
      } else {
        await signUp(email, password, { companyName, country });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50/90 via-white to-cyan-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 px-4 py-12">
      <div className="max-w-md w-full">
        <div className="rounded-xl border border-gray-200/90 dark:border-gray-700/90 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img
                src={BRAND_LOGO_FULL}
                alt={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
                className="h-24 sm:h-28 md:h-32 w-auto max-w-full"
              />
            </div>
            <h1 className="text-center text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {invited ? 'Join your team' : 'Create your account'}
            </h1>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              {invited
                ? 'Sign up with the email address your admin invited to join the company.'
                : "Set your business country and currency — we'll apply the right tax defaults for UAE or India."}
            </p>
          </div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <fieldset disabled={loading} className="min-w-0 border-0 p-0 m-0 space-y-4">
              {!invited ? (
                <>
                  <Input
                    label="Company name"
                    type="text"
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
                    helperText="Determines currency, tax type, and registration labels"
                  />

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Currency</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {countryProfile.currencyLabel}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Default tax</span>
                      <span className="font-medium text-gray-900 dark:text-white uppercase">
                        {countryProfile.defaultTaxType} · {countryProfile.defaultTaxPercentage}%
                        {' · '}
                        {countryProfile.defaultTaxMode.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                      Used as defaults for new products and sales. You can change these later in Settings.
                    </p>
                  </div>
                </>
              ) : null}

              <Input
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                autoComplete="email"
              />
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 6 characters"
                autoComplete="new-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
              />
              <Input
                label="Confirm password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter password"
                autoComplete="new-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
              />
            </fieldset>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <FormActions>
              <Button type="submit" fullWidth loading={loading} disabled={loading}>
                {invited ? 'Create account & join team' : 'Create account'}
              </Button>
            </FormActions>

            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              {invited ? (
                <>
                  Creating a new company instead?{' '}
                  <Link
                    to="/signup"
                    className="font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
                  >
                    Sign up as admin
                  </Link>
                </>
              ) : (
                <>
                  Invited by your team?{' '}
                  <Link
                    to="/signup?invited=1"
                    className="font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
                  >
                    Join with invite
                  </Link>
                </>
              )}
            </p>

            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
