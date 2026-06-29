import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../Input/Input';
import { Button } from '../Button/Button';
import { FormActions } from '../FormActions/FormActions';
import { BRAND_LOGO_FULL, BRAND_NAME, BRAND_TAGLINE } from '../../constants/brand';

export function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await sendPasswordReset(email);
      setSuccess('If this email is registered, a reset link has been sent. Please check your inbox.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unable to send reset email. Please try again.';
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
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Forgot password
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter your email address and we&apos;ll send a password reset link.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <fieldset disabled={loading} className="min-w-0 border-0 p-0 m-0 space-y-4">
              <Input
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                autoComplete="email"
              />
            </fieldset>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {success && (
              <div className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
                <p className="text-sm text-emerald-800 dark:text-emerald-200">{success}</p>
              </div>
            )}

            <FormActions>
              <Button type="submit" fullWidth loading={loading} disabled={loading}>
                Send reset link
              </Button>
            </FormActions>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                Back to sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
