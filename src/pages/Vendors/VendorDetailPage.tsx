import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Building2,
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
import { useAuth } from '../../hooks/useAuth';
import { useEntityDetail } from '../../hooks/useEntityDetail';
import { firestoreService } from '../../services/firestore';
import { formatMoney } from '../../utils/profit';

export function VendorDetailPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const { company } = useAuth();
  const currency = company?.currency ?? 'AED';
  const [expenseStats, setExpenseStats] = useState({ count: 0, total: 0 });

  const { entity: vendor, loading, notFound } = useEntityDetail({
    id: vendorId,
    fetch: firestoreService.vendors.get,
    errorMessage: 'Failed to load vendor',
  });

  useEffect(() => {
    if (!company || !vendorId) return;
    firestoreService.expenses.getAll(company.id).then((list) => {
      const vendorExpenses = list.filter((e) => !e.deleted && e.vendorId === vendorId);
      setExpenseStats({
        count: vendorExpenses.length,
        total: vendorExpenses.reduce((sum, e) => sum + e.amount, 0),
      });
    });
  }, [company, vendorId]);

  const isActive = vendor?.status === 'active';

  return (
    <EntityDetailShell
      loading={loading}
      loadingLabel="Loading vendor…"
      loadingIcon={Building2}
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
        vendor ? (
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
                label: 'Expenses',
                value: String(expenseStats.count),
                subtext: expenseStats.count === 1 ? 'Linked record' : 'Linked records',
                icon: Receipt,
                tone: 'indigo',
              },
              {
                label: 'Total paid',
                value: formatMoney(expenseStats.total, currency),
                subtext: 'All linked expenses',
                icon: Wallet,
                tone: 'emerald',
                valueClassName: 'text-emerald-700 dark:text-emerald-400',
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
            icon={Receipt}
            iconTone="emerald"
            title="Related expenses"
            description="Operating costs linked to this vendor."
            headerAction={
              expenseStats.count > 0 ? (
                <Link
                  to={`/expenses?vendor=${vendor.id}`}
                  className={`text-xs font-medium ${detailLinkClass}`}
                >
                  View all →
                </Link>
              ) : (
                <Link to={`/expenses/new?vendor=${vendor.id}`} className={`text-xs font-medium ${detailLinkClass}`}>
                  Add expense →
                </Link>
              )
            }
          >
            {expenseStats.count > 0 ? (
              <div className="rounded-lg border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/20 px-4 py-4">
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  <span className="font-semibold tabular-nums">{expenseStats.count}</span> expense
                  {expenseStats.count === 1 ? '' : 's'} totalling{' '}
                  <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatMoney(expenseStats.total, currency)}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No expenses linked yet.{' '}
                <Link to={`/expenses/new?vendor=${vendor.id}`} className={detailLinkClass}>
                  Record the first expense
                </Link>
              </p>
            )}
          </DetailSection>
        </>
      )}
    </EntityDetailShell>
  );
}
