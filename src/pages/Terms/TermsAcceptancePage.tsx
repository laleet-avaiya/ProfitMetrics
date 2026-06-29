import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, LogOut } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import {
  CURRENT_LEGAL_VERSION,
  LEGAL_LAST_UPDATED,
  TERMS_SECTIONS,
  USAGE_POLICY_SECTIONS,
} from '../../constants/legalTerms';
import { nowUtc } from '../../utils/firestoreDates';
import { BRAND_LOGO_FULL, BRAND_NAME } from '../../constants/brand';

export function TermsAcceptancePage() {
  const navigate = useNavigate();
  const { user, company, updateCompany, signOut } = useAuth();
  const notification = useNotification();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    if (!agreed || !user) return;

    setSaving(true);
    try {
      const now = nowUtc();
      await updateCompany({
        termsVersion: CURRENT_LEGAL_VERSION,
        termsAcceptedAt: now,
        usagePolicyAcceptedAt: now,
        legalAcceptedByUserId: user.uid,
      });
      notification.success('Terms accepted — welcome to Profit Metrics');
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Failed to save legal consent:', err);
      notification.error('Could not save your acceptance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Accept Terms & Usage Policy
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Before using Profit Metrics
              {company?.name ? (
                <> for <strong className="text-gray-900 dark:text-white">{company.name}</strong></>
              ) : null}
              , please review and accept our Terms & Conditions and Usage Policy (version{' '}
              {CURRENT_LEGAL_VERSION}, updated {LEGAL_LAST_UPDATED}).
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="max-h-[min(50vh,28rem)] overflow-y-auto p-5 sm:p-6 space-y-6 text-sm">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Terms & Conditions</h2>
                <div className="space-y-3">
                  {TERMS_SECTIONS.map((section) => (
                    <div key={section.title}>
                      <h3 className="font-medium text-gray-800 dark:text-gray-200">{section.title}</h3>
                      <p className="mt-0.5 text-gray-600 dark:text-gray-400 leading-relaxed">{section.body}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Usage Policy</h2>
                <div className="space-y-3">
                  {USAGE_POLICY_SECTIONS.map((section) => (
                    <div key={section.title}>
                      <h3 className="font-medium text-gray-800 dark:text-gray-200">{section.title}</h3>
                      <p className="mt-0.5 text-gray-600 dark:text-gray-400 leading-relaxed">{section.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Read the full documents anytime from{' '}
            <Link to="/terms" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Terms & Usage Policy
            </Link>
            .
          </p>

          <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              I have read and agree to the{' '}
              <strong className="text-gray-900 dark:text-white">Terms & Conditions</strong> and{' '}
              <strong className="text-gray-900 dark:text-white">Usage Policy</strong> on behalf of my
              company. I understand acceptance is recorded with the current version ({CURRENT_LEGAL_VERSION}).
            </span>
          </label>

          <Button
            type="button"
            variant="primary"
            fullWidth
            loading={saving}
            disabled={!agreed}
            onClick={handleAccept}
          >
            Accept and continue
          </Button>
        </div>
      </main>
    </div>
  );
}
