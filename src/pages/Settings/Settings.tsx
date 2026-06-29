import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { Button } from '../../components/Button/Button';
import { FormActions } from '../../components/FormActions/FormActions';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import {
  BusinessCountry,
  COUNTRY_OPTIONS,
  countryDefaultsForCompany,
  getCountryProfile,
  isBusinessCountry,
} from '../../constants/countries';
import { TaxMode, TaxType } from '../../types';
import {
  Building2,
  Upload,
  X,
  Lock,
  Eye,
  EyeOff,
  UserCircle,
} from 'lucide-react';

type SettingsTab = 'company' | 'account';

const LOGO_MAX_SIZE_BYTES = 1024 * 1024;
const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export function Settings() {
  const { user, company, updateCompany, changePassword } = useAuth();
  const notification = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: SettingsTab =
    searchParams.get('tab') === 'account' && user?.email ? 'account' : 'company';

  const setActiveTab = (tab: SettingsTab) => {
    if (tab === 'account' && !user?.email) return;
    setSearchParams(tab === 'company' ? {} : { tab: 'account' });
  };

  const [isLoading, setIsLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    country: BusinessCountry.UAE as BusinessCountry,
    trn: '',
    address: '',
    phone: '',
    phone2: '',
    email: '',
    logo: '',
    defaultTaxType: TaxType.VAT as (typeof TaxType)[keyof typeof TaxType],
    defaultTaxMode: TaxMode.INCLUSIVE as (typeof TaxMode)[keyof typeof TaxMode],
    defaultTaxPercentage: '5',
  });

  const localeProfile = useMemo(() => getCountryProfile(formData.country), [formData.country]);

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        country: isBusinessCountry(company.country) ? company.country : BusinessCountry.UAE,
        trn: company.trn || '',
        address: company.address || '',
        phone: company.phone || '',
        phone2: company.phone2 || '',
        email: company.email || '',
        logo: company.logo || '',
        defaultTaxType: company.defaultTaxType ?? TaxType.VAT,
        defaultTaxMode: company.defaultTaxMode ?? TaxMode.INCLUSIVE,
        defaultTaxPercentage: String(company.defaultTaxPercentage ?? 5),
      });
    }
  }, [company]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!company) return;

    setIsLoading(true);
    try {
      await updateCompany({
        name: formData.name,
        country: formData.country,
        currency: getCountryProfile(formData.country).currency,
        timezone: getCountryProfile(formData.country).timezone,
        trn: formData.trn || undefined,
        address: formData.address || undefined,
        phone: formData.phone || undefined,
        phone2: formData.phone2 || undefined,
        email: formData.email || undefined,
        logo: formData.logo || undefined,
        defaultTaxType: formData.defaultTaxType,
        defaultTaxMode: formData.defaultTaxMode,
        defaultTaxPercentage: parseFloat(formData.defaultTaxPercentage) || 0,
      });
      notification.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      notification.error('Failed to save settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'country' && isBusinessCountry(value)) {
        const defaults = countryDefaultsForCompany(value);
        next.defaultTaxType = defaults.defaultTaxType;
        next.defaultTaxMode = defaults.defaultTaxMode;
        next.defaultTaxPercentage = String(defaults.defaultTaxPercentage);
      }
      return next;
    });
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError('Invalid file type. Use JPEG, PNG, GIF, WebP or SVG.');
      e.target.value = '';
      return;
    }
    if (file.size > LOGO_MAX_SIZE_BYTES) {
      setLogoError('File too large. Maximum size is 1MB for storage in company document.');
      e.target.value = '';
      return;
    }
    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, logo: reader.result as string }));
      setLogoUploading(false);
    };
    reader.onerror = () => {
      setLogoError('Failed to read file.');
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveLogo = () => {
    notification.confirm({
      title: 'Remove logo?',
      message: 'Your company logo will be cleared. You can upload a new one anytime.',
      confirmLabel: 'Remove',
      onConfirm: () => {
        setFormData((prev) => ({ ...prev, logo: '' }));
        setLogoError(null);
      },
    });
  };

  const handlePasswordChange = (field: keyof typeof passwordForm, value: string) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordError(null);
    setPasswordSuccess(false);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (passwordForm.newPassword.length < 5) {
      setPasswordError('New password must be at least 5 characters.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (!passwordForm.currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (!company) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-600 dark:text-gray-400">Loading company information...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader title="Settings" description="Company profile and account security" />

        <div
          className="flex flex-wrap gap-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-700/40 border border-gray-200/80 dark:border-gray-600/80 w-full sm:w-fit"
          role="tablist"
          aria-label="Settings sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'company'}
            onClick={() => setActiveTab('company')}
            disabled={isLoading || changingPassword}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'company'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200/80 dark:ring-gray-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            } disabled:opacity-50`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            Company
          </button>
          {user?.email && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'account'}
              onClick={() => setActiveTab('account')}
              disabled={isLoading || changingPassword}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'account'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200/80 dark:ring-gray-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              } disabled:opacity-50`}
            >
              <UserCircle className="w-4 h-4 shrink-0" />
              Account
            </button>
          )}
        </div>

        {activeTab === 'company' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <fieldset disabled={isLoading} className="min-w-0 border-0 p-0 m-0 space-y-4">
                <Input
                  label="Company Name"
                  name="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                  placeholder="Enter company name"
                />

                <Select
                  label="Business country"
                  name="country"
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  options={COUNTRY_OPTIONS}
                  required
                  helperText="Updates currency and suggested tax defaults for new products & sales"
                />

                <Input
                  label={localeProfile.taxIdLabel}
                  name="trn"
                  value={formData.trn}
                  onChange={(e) => handleChange('trn', e.target.value)}
                  placeholder={localeProfile.taxIdPlaceholder}
                  maxLength={localeProfile.taxIdMaxLength}
                />

                <div className="grid gap-4 sm:grid-cols-3">
                  <Select
                    label="Default tax type"
                    name="defaultTaxType"
                    value={formData.defaultTaxType}
                    onChange={(e) => handleChange('defaultTaxType', e.target.value)}
                    options={[
                      { value: TaxType.NONE, label: 'None' },
                      { value: TaxType.VAT, label: 'VAT (UAE)' },
                      { value: TaxType.GST, label: 'GST (India)' },
                      { value: TaxType.SALES_TAX, label: 'Sales tax' },
                    ]}
                  />
                  <Select
                    label="Tax on price"
                    name="defaultTaxMode"
                    value={formData.defaultTaxMode}
                    onChange={(e) => handleChange('defaultTaxMode', e.target.value)}
                    options={[
                      { value: TaxMode.INCLUSIVE, label: 'Inclusive' },
                      { value: TaxMode.EXCLUSIVE, label: 'Exclusive' },
                      { value: TaxMode.PASS_THROUGH, label: 'Pass-through' },
                    ]}
                  />
                  <Input
                    label="Default tax %"
                    name="defaultTaxPercentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.defaultTaxPercentage}
                    onChange={(e) => handleChange('defaultTaxPercentage', e.target.value)}
                  />
                </div>

                <Input
                  label="Address"
                  name="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Enter complete address"
                />
                <Input
                  label="Phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder={localeProfile.phonePlaceholder}
                />
                <Input
                  label="Phone 2"
                  name="phone2"
                  type="tel"
                  value={formData.phone2}
                  onChange={(e) => handleChange('phone2', e.target.value)}
                  placeholder={localeProfile.phonePlaceholder}
                />
                <Input
                  label="Company Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="company@example.com"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Logo (Optional)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoFileSelect}
                    disabled={logoUploading}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      loading={logoUploading}
                    >
                      <Upload className="w-4 h-4" />
                      {formData.logo ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                    {formData.logo && (
                      <Button type="button" variant="outline" onClick={handleRemoveLogo} disabled={logoUploading}>
                        <X className="w-4 h-4" />
                        Remove Logo
                      </Button>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    JPEG, PNG, GIF, WebP or SVG. Max 1MB.
                  </p>
                  {logoError && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{logoError}</p>
                  )}
                  {formData.logo && (
                    <div className="mt-3 w-32 h-32 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
                      <img src={formData.logo} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                    </div>
                  )}
                </div>
              </fieldset>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Currency</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">All amounts in reports & forms</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    {localeProfile.currencyLabel}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Timezone</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">For daily sales & reports</p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {localeProfile.timezone}
                  </p>
                </div>
              </div>

              <FormActions layout="end" className="border-t border-gray-200 dark:border-gray-700">
                <Button type="submit" variant="primary" loading={isLoading}>
                  Save settings
                </Button>
              </FormActions>
            </form>
          </div>
        )}

        {activeTab === 'account' && user?.email && (
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Change password</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Signed in as <span className="font-medium text-gray-800 dark:text-gray-200">{user.email}</span>
            </p>
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <fieldset disabled={changingPassword} className="min-w-0 border-0 p-0 m-0 space-y-4">
                <Input
                  label="Current password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                  autoComplete="current-password"
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  }
                />
                <Input
                  label="New password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                  autoComplete="new-password"
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  }
                />
                <Input
                  label="Confirm new password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                  autoComplete="new-password"
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  }
                />
                {passwordError && <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>}
                {passwordSuccess && (
                  <p className="text-sm text-green-600 dark:text-green-400">Password changed successfully.</p>
                )}
              </fieldset>
              <FormActions layout="end">
                <Button type="submit" variant="primary" loading={changingPassword}>
                  Update password
                </Button>
              </FormActions>
            </form>
          </div>
        )}
      </PageShell>
    </Layout>
  );
}
