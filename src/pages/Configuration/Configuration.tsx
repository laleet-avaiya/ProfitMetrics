import { useEffect, useState } from 'react';
import { Plus, RotateCcw, SlidersHorizontal, Store, Trash2 } from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { FormSection } from '../../components/FormSection/FormSection';
import { FormStickyActions } from '../../components/FormStickyActions/FormStickyActions';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import {
  DEFAULT_MARKETPLACES,
  getCompanyMarketplaces,
  normalizeMarketplaceList,
  normalizeMarketplaceName,
} from '../../constants/platforms';

export function Configuration() {
  const { company, updateCompany } = useAuth();
  const notification = useNotification();
  const [marketplaces, setMarketplaces] = useState<string[]>([]);
  const [newMarketplace, setNewMarketplace] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMarketplaces(getCompanyMarketplaces(company));
  }, [company]);

  const handleAdd = () => {
    const name = normalizeMarketplaceName(newMarketplace);
    if (!name) return;
    if (marketplaces.some((m) => m.toLowerCase() === name.toLowerCase())) {
      notification.error('That marketplace is already in the list.');
      return;
    }
    setMarketplaces((prev) => [...prev, name]);
    setNewMarketplace('');
  };

  const handleRemove = (name: string) => {
    if (marketplaces.length <= 1) {
      notification.error('Keep at least one marketplace.');
      return;
    }
    setMarketplaces((prev) => prev.filter((m) => m !== name));
  };

  const handleRestoreDefaults = () => {
    setMarketplaces([...DEFAULT_MARKETPLACES]);
  };

  const handleSave = async () => {
    const normalized = normalizeMarketplaceList(marketplaces);
    if (normalized.length === 0) {
      notification.error('Add at least one marketplace.');
      return;
    }

    setSaving(true);
    try {
      await updateCompany({ marketplaces: normalized });
      notification.success('Configuration saved');
    } catch {
      notification.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title="Configuration"
          description="Manage dropdown options used across the app — starting with your marketplace list."
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-6 pb-24"
        >
          <FormSection
            icon={Store}
            iconTone="indigo"
            title="Marketplaces"
            description="Marketplace names come from Configuration. These appear on product listings and marketplace payout payments."
          >
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  label="Add marketplace"
                  value={newMarketplace}
                  onChange={(e) => setNewMarketplace(e.target.value)}
                  placeholder="e.g. Amazon, Meesho"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                />
                <div className="sm:pt-6">
                  <Button type="button" variant="outline" onClick={handleAdd} disabled={!newMarketplace.trim()}>
                    <Plus className="w-4 h-4" />
                    Add
                  </Button>
                </div>
              </div>

              <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {marketplaces.map((name) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white dark:bg-gray-800"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(name)}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      aria-label={`Remove ${name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Existing sales and products keep their saved platform names even if you remove a
                marketplace from this list. Add a name here before using it on new product listings.
              </p>

              <Button type="button" variant="ghost" size="sm" onClick={handleRestoreDefaults}>
                <RotateCcw className="w-4 h-4" />
                Restore defaults
              </Button>
            </div>
          </FormSection>

          <FormStickyActions>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <SlidersHorizontal className="w-4 h-4" />
              Changes apply to dropdowns immediately after saving.
            </div>
            <Button type="submit" variant="primary" loading={saving}>
              Save configuration
            </Button>
          </FormStickyActions>
        </form>
      </PageShell>
    </Layout>
  );
}
