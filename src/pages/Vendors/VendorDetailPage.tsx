import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { EntityDetailShell } from '../../components/DetailPage/EntityDetailShell';
import { DetailField, DetailGrid } from '../../components/DetailPage/DetailField';
import { Button } from '../../components/Button/Button';
import { Card, CardHeader, StatCard } from '../../components/ui/Card';
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
      description={vendor?.contactName ? `Contact: ${vendor.contactName}` : undefined}
      actions={
        vendor ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(`/vendors/${vendor.id}/edit`)}
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
        ) : null
      }
    >
      {vendor && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard label="Expenses" value={String(expenseStats.count)} />
            <StatCard label="Total paid" value={formatMoney(expenseStats.total, currency)} />
          </div>

          <Card>
            <CardHeader title="Vendor details" />
            <DetailGrid columns={2}>
              <DetailField label="Name" value={vendor.name} />
              <DetailField
                label="Status"
                value={
                  <span
                    className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                      vendor.status === 'active'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {vendor.status === 'active' ? 'Active' : 'Archived'}
                  </span>
                }
              />
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
                      className="text-indigo-600 dark:text-indigo-400 hover:underline break-all"
                    >
                      {vendor.website}
                    </a>
                  ) : null
                }
              />
            </DetailGrid>
            {vendor.notes && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <DetailField label="Notes" value={vendor.notes} />
              </div>
            )}
          </Card>

          {expenseStats.count > 0 && (
            <Card>
              <CardHeader
                title="Related expenses"
                action={
                  <Link
                    to={`/expenses?vendor=${vendor.id}`}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View all
                  </Link>
                }
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {expenseStats.count} expense{expenseStats.count === 1 ? '' : 's'} totalling{' '}
                {formatMoney(expenseStats.total, currency)}.
              </p>
            </Card>
          )}
        </>
      )}
    </EntityDetailShell>
  );
}
