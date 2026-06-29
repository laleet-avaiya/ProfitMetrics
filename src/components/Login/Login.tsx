import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../Input/Input';
import { Button } from '../Button/Button';
import { FormActions } from '../FormActions/FormActions';
import { Eye, EyeOff } from 'lucide-react';
import { BRAND_LOGO_FULL, BRAND_NAME, BRAND_TAGLINE } from '../../constants/brand';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in. Please check your credentials.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50/90 via-white to-cyan-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 px-4 py-8">
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
              Sign in to your account
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Use the email and password for your company workspace.
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
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                autoComplete="current-password"
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
              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-xs sm:text-sm font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
                >
                  Forgot password?
                </Link>
              </div>
            </fieldset>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <FormActions>
              <Button type="submit" fullWidth loading={loading} disabled={loading}>
                Sign in
              </Button>
            </FormActions>

            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Don&apos;t have an account?{' '}
                <Link
                  to="/signup"
                  className="font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

