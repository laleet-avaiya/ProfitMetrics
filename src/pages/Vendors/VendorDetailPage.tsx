import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Building2,
  ClipboardList,
  Mail,
  Pencil,
  Phone,
  Receipt,
  UserCircle,
  Wallet,
} from 'lucide-react';
import { EntityDetailShell } from '../../components/DetailPage/EntityDetailShell';
import { DetailField, DetailGrid, detailLinkClass } from '../../components/DetailPage/DetailField';
import { DetailMetaChip, DetailMetaRow } from '../../components/DetailPage/DetailMeta';
import { DetailSection } from '../../components/DetailPage/DetailSection';
import { DetailStatStrip } from '../../components/DetailPage/DetailStatStrip';
import { Button } from '../../components/Button/Button';
import { AppModule } from '../../constants/permissions';
import { useAuth } from '../../hooks/useAuth';
import { useEntityDetail } from '../../hooks/useEntityDetail';
import { useModuleAccess } from '../../hooks/usePermissions';
import { firestoreService } from '../../services/firestore';
import type { Expense, PurchaseOrder } from '../../types';
import { formatDateLocal } from '../../utils/date';
import { formatMoney } from '../../utils/profit';
import { buildVendorLedger } from '../../utils/vendorLedger';

export function VendorDetailPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const { company } = useAuth();
  const { canUpdate } = useModuleAccess(AppModule.VENDORS);
  const currency = company?.currency ?? 'AED';
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const { entity: vendor, loading, notFound } = useEntityDetail({
    id: vendorId,
    fetch: firestoreService.vendors.get,
    errorMessage: 'Failed to load vendor',
  });

  useEffect(() => {
    if (!company) return;
    Promise.all([
      firestoreService.purchases.getAll(company.id),
      firestoreService.expenses.getAll(company.id),
    ]).then(([purchaseList, expenseList]) => {
      setPurchases(purchaseList.filter((p) => !p.deleted));
      setExpenses(expenseList.filter((e) => !e.deleted));
    });
  }, [company]);

  const ledger = useMemo(() => {
    if (!vendorId) {
      return {
        totalPurchases: 0,
        totalPaid: 0,
        balanceDue: 0,
        openOrders: 0,
        entries: [],
      };
    }
    return buildVendorLedger(vendorId, purchases, expenses);
  }, [vendorId, purchases, expenses]);

  const vendorPurchases = useMemo(
    () => purchases.filter((p) => p.vendorId === vendorId),
    [purchases, vendorId]
  );

  const ledgerWithBalance = useMemo(() => {
    let balance = 0;
    return ledger.entries.map((entry) => {
      balance += entry.debit - entry.credit;
      return { ...entry, balance: Math.round(balance * 100) / 100 };
    });
  }, [ledger.entries]);

  const isActive = vendor?.status === 'active';

  return (
    <EntityDetailShell
      loading={loading}
      loadingLabel="Loading vendor…"
      notFound={notFound}
      notFoundTitle="Vendor not found"
      notFoundDescription="This vendor may have been deleted."
      backTo="/vendors"
      backLabel="Back to vendors"
      title={vendor?.name ?? 'Vendor'}
      description={vendor?.contactName ? `Contact: ${vendor.contactName}` : 'Supplier or payee'}
      meta={
        vendor ? (
          <DetailMetaRow>
            <DetailMetaChip tone={isActive ? 'emerald' : 'gray'}>
              {isActive ? 'Active' : 'Archived'}
            </DetailMetaChip>
            {vendor.email ? (
              <DetailMetaChip tone="gray" icon={<Mail className="w-3 h-3" />}>
                {vendor.email}
              </DetailMetaChip>
            ) : null}
            {vendor.phone ? (
              <DetailMetaChip tone="gray" icon={<Phone className="w-3 h-3" />}>
                {vendor.phone}
              </DetailMetaChip>
            ) : null}
          </DetailMetaRow>
        ) : undefined
      }
      actions={
        vendor && canUpdate ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/vendors/${vendor.id}/edit`)}
          >
            <Pencil className="w-4 h-4" />
            Edit vendor
          </Button>
        ) : null
      }
    >
      {vendor && (
        <>
          <DetailStatStrip
            stats={[
              {
                label: 'Purchase orders',
                value: String(vendorPurchases.length),
                subtext: `${ledger.openOrders} open`,
                icon: ClipboardList,
                tone: 'indigo',
              },
              {
                label: 'Total purchases',
                value: formatMoney(ledger.totalPurchases, currency),
                subtext: 'All PO value',
                icon: Receipt,
                tone: 'slate',
              },
              {
                label: 'Total paid',
                value: formatMoney(ledger.totalPaid, currency),
                subtext: 'Payments & expenses',
                icon: Wallet,
                tone: 'emerald',
                valueClassName: 'text-emerald-700 dark:text-emerald-400',
              },
              {
                label: 'Balance due',
                value: formatMoney(ledger.balanceDue, currency),
                subtext: 'Outstanding on POs',
                icon: Building2,
                tone: ledger.balanceDue > 0 ? 'amber' : 'emerald',
              },
            ]}
          />

          <DetailSection
            icon={Building2}
            iconTone="indigo"
            title="Vendor details"
            description="Identity and status for this payee."
          >
            <DetailGrid columns={2}>
              <DetailField label="Name" value={vendor.name} valueClassName="font-semibold" />
              <DetailField
                label="Status"
                value={
                  <span
                    className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${
                      isActive
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {isActive ? 'Active' : 'Archived'}
                  </span>
                }
              />
            </DetailGrid>
          </DetailSection>

          <DetailSection
            icon={UserCircle}
            iconTone="violet"
            title="Contact"
            description="How to reach this vendor."
          >
            <DetailGrid columns={2}>
              <DetailField label="Contact name" value={vendor.contactName} />
              <DetailField label="Email" value={vendor.email} />
              <DetailField label="Phone" value={vendor.phone} />
              <DetailField
                label="Website"
                value={
                  vendor.website ? (
                    <a
                      href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${detailLinkClass} break-all`}
                    >
                      {vendor.website}
                    </a>
                  ) : null
                }
              />
            </DetailGrid>
            {vendor.notes ? (
              <div className="mt-4 rounded-lg border border-gray-200/80 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                  Notes
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {vendor.notes}
                </p>
              </div>
            ) : null}
          </DetailSection>

          <DetailSection
            icon={ClipboardList}
            iconTone="indigo"
            title="Purchase orders"
            description="Orders placed with this vendor."
            headerAction={
              <Link
                to={`/purchases/new?vendor=${vendor.id}`}
                className={`text-xs font-medium ${detailLinkClass}`}
              >
                New PO →
              </Link>
            }
          >
            {vendorPurchases.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">PO #</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {vendorPurchases.slice(0, 10).map((po) => (
                      <tr key={po.id}>
                        <td className="px-3 py-2">{formatDateLocal(po.purchaseDate)}</td>
                        <td className="px-3 py-2">
                          <Link to={`/purchases/${po.id}`} className={detailLinkClass}>
                            {po.poNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatMoney(po.total, currency)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                          {po.balanceDue > 0 ? formatMoney(po.balanceDue, currency) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No purchase orders yet.{' '}
                <Link to={`/purchases/new?vendor=${vendor.id}`} className={detailLinkClass}>
                  Create first PO
                </Link>
              </p>
            )}
          </DetailSection>

          <DetailSection
            icon={Wallet}
            iconTone="emerald"
            title="Vendor ledger"
            description="Running balance from purchase orders, payments, and manual expenses."
          >
            {ledgerWithBalance.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {ledgerWithBalance.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-3 py-2">{formatDateLocal(entry.date)}</td>
                        <td className="px-3 py-2 capitalize">{entry.type}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{entry.description}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {entry.debit > 0 ? formatMoney(entry.debit, currency) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {entry.credit > 0 ? formatMoney(entry.credit, currency) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatMoney(entry.balance, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No ledger activity yet.</p>
            )}
          </DetailSection>

          <DetailSection
            icon={Receipt}
            iconTone="emerald"
            title="Related expenses"
            description="Operating costs linked to this vendor."
            headerAction={
              <Link to={`/expenses?vendor=${vendor.id}`} className={`text-xs font-medium ${detailLinkClass}`}>
                View all →
              </Link>
            }
          >
            <Link to={`/expenses/new?vendor=${vendor.id}`} className={`text-sm ${detailLinkClass}`}>
              Record manual expense →
            </Link>
          </DetailSection>
        </>
      )}
    </EntityDetailShell>
  );
}
