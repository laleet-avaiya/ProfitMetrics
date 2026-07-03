import { useEffect, useState } from 'react';
import { FileText, Landmark, Plus, RotateCcw, SlidersHorizontal, Store, Trash2 } from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Button } from '../../components/Button/Button';
import { FormStickyActions } from '../../components/FormStickyActions/FormStickyActions';
import {
  FormFieldGroup,
  FormPageBody,
  FormPageGrid,
  FormPanel,
} from '../../components/FormPage';
import { FormTabs } from '../../components/ui/FormTabs';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import {
  DEFAULT_MARKETPLACES,
  getCompanyMarketplaces,
  normalizeMarketplaceList,
  normalizeMarketplaceName,
} from '../../constants/platforms';

type ConfigurationTab = 'marketplaces' | 'invoice' | 'bank';

const emptyInvoiceBank = {
  bankName: '',
  bankAccountName: '',
  bankIban: '',
  bankAccountNumber: '',
  bankSwift: '',
  invoiceFooterNotes: '',
  invoiceTerms: '',
};

export function Configuration() {
  const { company, updateCompany } = useAuth();
  const notification = useNotification();
  const [marketplaces, setMarketplaces] = useState<string[]>([]);
  const [newMarketplace, setNewMarketplace] = useState('');
  const [invoiceBank, setInvoiceBank] = useState(emptyInvoiceBank);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ConfigurationTab>('marketplaces');

  useEffect(() => {
    setMarketplaces(getCompanyMarketplaces(company));
  }, [company]);

  useEffect(() => {
    if (!company) return;
    setInvoiceBank({
      bankName: company.bankName || '',
      bankAccountName: company.bankAccountName || '',
      bankIban: company.bankIban || '',
      bankAccountNumber: company.bankAccountNumber || '',
      bankSwift: company.bankSwift || '',
      invoiceFooterNotes: company.invoiceFooterNotes || '',
      invoiceTerms: company.invoiceTerms || '',
    });
  }, [company]);

  const handleInvoiceBankChange = (field: keyof typeof emptyInvoiceBank, value: string) => {
    setInvoiceBank((prev) => ({ ...prev, [field]: value }));
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeMarketplaceList(marketplaces);
    if (normalized.length === 0) {
      notification.error('Add at least one marketplace.');
      return;
    }

    setSaving(true);
    try {
      await updateCompany({
        marketplaces: normalized,
        bankName: invoiceBank.bankName || undefined,
        bankAccountName: invoiceBank.bankAccountName || undefined,
        bankIban: invoiceBank.bankIban || undefined,
        bankAccountNumber: invoiceBank.bankAccountNumber || undefined,
        bankSwift: invoiceBank.bankSwift || undefined,
        invoiceFooterNotes: invoiceBank.invoiceFooterNotes || undefined,
        invoiceTerms: invoiceBank.invoiceTerms || undefined,
      });
      notification.success('Configuration saved');
    } catch {
      notification.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const formTabs = [
    { id: 'marketplaces' as const, label: 'Marketplaces', icon: Store },
    { id: 'invoice' as const, label: 'Invoice', icon: FileText },
    { id: 'bank' as const, label: 'Bank details', icon: Landmark },
  ];

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title="Configuration"
          description="Manage marketplaces, invoice content, and bank details used across the app."
          actions={
            <div className="hidden lg:flex">
              <Button type="submit" form="config-form" variant="primary" loading={saving}>
                Save configuration
              </Button>
            </div>
          }
        />

        <FormPageBody id="config-form" onSubmit={handleSubmit}>
          <FormTabs
            tabs={formTabs}
            active={activeTab}
            onChange={(id) => setActiveTab(id as ConfigurationTab)}
            ariaLabel="Configuration sections"
          />

          <FormPageGrid>
            <FormPanel role="tabpanel">
              {activeTab === 'marketplaces' ? (
                <FormFieldGroup
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
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAdd}
                          disabled={!newMarketplace.trim()}
                        >
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
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {name}
                          </span>
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
                      marketplace from this list. Add a name here before using it on new product
                      listings.
                    </p>

                    <Button type="button" variant="ghost" size="sm" onClick={handleRestoreDefaults}>
                      <RotateCcw className="w-4 h-4" />
                      Restore defaults
                    </Button>
                  </div>
                </FormFieldGroup>
              ) : null}

              {activeTab === 'invoice' ? (
                <FormFieldGroup
                  title="Invoice content"
                  description="Shown on the professional (grid) invoice layout when printing sales or invoices."
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Textarea
                      label="Invoice footer notes"
                      name="invoiceFooterNotes"
                      value={invoiceBank.invoiceFooterNotes}
                      onChange={(e) => handleInvoiceBankChange('invoiceFooterNotes', e.target.value)}
                      placeholder="Thank you for your business."
                      rows={3}
                      optional
                    />
                    <Textarea
                      label="Terms & conditions"
                      name="invoiceTerms"
                      value={invoiceBank.invoiceTerms}
                      onChange={(e) => handleInvoiceBankChange('invoiceTerms', e.target.value)}
                      placeholder="Report any issues within 3 days."
                      rows={3}
                      optional
                    />
                  </div>
                </FormFieldGroup>
              ) : null}

              {activeTab === 'bank' ? (
                <FormFieldGroup
                  title="Bank details"
                  description="Shown on the professional (grid) invoice layout when printing sales or invoices."
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                    <div className="lg:col-span-4">
                      <Input
                        label="Bank name"
                        name="bankName"
                        value={invoiceBank.bankName}
                        onChange={(e) => handleInvoiceBankChange('bankName', e.target.value)}
                        placeholder="e.g. Emirates NBD"
                      />
                    </div>
                    <div className="lg:col-span-4">
                      <Input
                        label="Beneficiary name"
                        name="bankAccountName"
                        value={invoiceBank.bankAccountName}
                        onChange={(e) => handleInvoiceBankChange('bankAccountName', e.target.value)}
                        placeholder="Account holder name"
                      />
                    </div>
                    <div className="lg:col-span-4">
                      <Input
                        label="IBAN"
                        name="bankIban"
                        value={invoiceBank.bankIban}
                        onChange={(e) => handleInvoiceBankChange('bankIban', e.target.value)}
                        placeholder="AE00…"
                      />
                    </div>
                    <div className="lg:col-span-4">
                      <Input
                        label="Account number"
                        name="bankAccountNumber"
                        value={invoiceBank.bankAccountNumber}
                        onChange={(e) => handleInvoiceBankChange('bankAccountNumber', e.target.value)}
                      />
                    </div>
                    <div className="lg:col-span-4">
                      <Input
                        label="SWIFT / BIC"
                        name="bankSwift"
                        value={invoiceBank.bankSwift}
                        onChange={(e) => handleInvoiceBankChange('bankSwift', e.target.value)}
                      />
                    </div>
                  </div>
                </FormFieldGroup>
              ) : null}
            </FormPanel>
          </FormPageGrid>

          <FormStickyActions className="lg:hidden">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <SlidersHorizontal className="w-4 h-4" />
              Changes apply to dropdowns immediately after saving.
            </div>
            <Button type="submit" variant="primary" loading={saving}>
              Save configuration
            </Button>
          </FormStickyActions>
        </FormPageBody>
      </PageShell>
    </Layout>
  );
}
