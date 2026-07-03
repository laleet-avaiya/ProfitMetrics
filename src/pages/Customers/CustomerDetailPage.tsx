import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText, Mail, Pencil, Phone, UserCircle, Wallet } from 'lucide-react';
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
import type { Payment, Sale } from '../../types';
import { SaleStatus } from '../../types';
import { buildCustomerLedger } from '../../utils/customerHelpers';
import { formatDateLocal } from '../../utils/date';
import { formatMoney } from '../../utils/profit';

export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { company } = useAuth();
  const { canUpdate } = useModuleAccess(AppModule.CUSTOMERS);
  const currency = company?.currency ?? 'AED';
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const { entity: customer, loading, notFound } = useEntityDetail({
    id: customerId,
    fetch: firestoreService.customers.get,
    errorMessage: 'Failed to load customer',
  });

  useEffect(() => {
    if (!company) return;
    Promise.all([
      firestoreService.payments.getAll(company.id),
      firestoreService.sales.getAll(company.id),
    ]).then(([pay, sale]) => {
      setPayments(pay.filter((p) => !p.deleted));
      setSales(sale.filter((s) => !s.deleted));
    });
  }, [company]);

  const ledger = useMemo(() => {
    if (!customerId) {
      return {
        totalInvoiced: 0,
        totalPaid: 0,
        balanceDue: 0,
        openInvoices: 0,
        entries: [],
      };
    }
    return buildCustomerLedger(customerId, payments, sales);
  }, [customerId, payments, sales]);

  const ledgerWithBalance = useMemo(() => {
    let balance = 0;
    return ledger.entries.map((entry) => {
      balance += entry.debit - entry.credit;
      return { ...entry, balance: Math.round(balance * 100) / 100 };
    });
  }, [ledger.entries]);

  const customerSales = useMemo(
    () =>
      sales
        .filter((s) => s.customerId === customerId && s.status !== SaleStatus.CANCELLED)
        .sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime()),
    [sales, customerId]
  );

  return (
    <EntityDetailShell
      loading={loading}
      loadingLabel="Loading customer…"
      notFound={notFound}
      notFoundTitle="Customer not found"
      notFoundDescription="This customer may have been deleted."
      backTo="/customers"
      backLabel="Back to customers"
      title={customer?.name ?? 'Customer'}
      description={customer?.contactName ? `Contact: ${customer.contactName}` : undefined}
      meta={
        customer ? (
          <DetailMetaRow>
            <DetailMetaChip tone={customer.status === 'active' ? 'emerald' : 'gray'}>
              {customer.status === 'active' ? 'Active' : 'Archived'}
            </DetailMetaChip>
            {customer.email ? (
              <DetailMetaChip tone="gray" icon={<Mail className="w-3 h-3" />}>
                {customer.email}
              </DetailMetaChip>
            ) : null}
            {customer.phone ? (
              <DetailMetaChip tone="gray" icon={<Phone className="w-3 h-3" />}>
                {customer.phone}
              </DetailMetaChip>
            ) : null}
          </DetailMetaRow>
        ) : undefined
      }
      actions={
        customer && canUpdate ? (
          <Button variant="outline" onClick={() => navigate(`/customers/${customer.id}/edit`)}>
            <Pencil className="w-4 h-4" />
            Edit customer
          </Button>
        ) : null
      }
    >
      {customer && (
        <>
          <DetailStatStrip
            stats={[
              {
                label: 'Ordered',
                value: formatMoney(ledger.totalInvoiced, currency),
                subtext: `${ledger.openInvoices} open order${ledger.openInvoices === 1 ? '' : 's'}`,
                icon: FileText,
                tone: 'indigo',
              },
              {
                label: 'Received',
                value: formatMoney(ledger.totalPaid, currency),
                subtext: 'All payments',
                icon: Wallet,
                tone: 'emerald',
                valueClassName: 'text-emerald-700 dark:text-emerald-400',
              },
              {
                label: 'Balance due',
                value: formatMoney(ledger.balanceDue, currency),
                subtext: 'Outstanding on orders',
                icon: UserCircle,
                tone: ledger.balanceDue > 0 ? 'amber' : 'emerald',
              },
            ]}
          />

          <DetailSection icon={UserCircle} iconTone="indigo" title="Contact" description="How to reach this customer.">
            <DetailGrid columns={2}>
              <DetailField label="Contact name" value={customer.contactName} />
              <DetailField label="Email" value={customer.email} />
              <DetailField label="Phone" value={customer.phone} />
              <DetailField label="Tax ID" value={customer.taxId} />
              <DetailField label="Address" value={customer.address} className="sm:col-span-2" />
            </DetailGrid>
          </DetailSection>

          <DetailSection
            icon={FileText}
            iconTone="violet"
            title="Orders"
            description="Sales orders for this customer."
            headerAction={
              <Link to={`/sales?customer=${customer.id}`} className={`text-xs font-medium ${detailLinkClass}`}>
                View sales →
              </Link>
            }
          >
            {customerSales.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No orders yet.{' '}
                <Link to="/sales/new" className={detailLinkClass}>
                  Create first sale
                </Link>
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {customerSales.map((sale) => {
                      const total = sale.total ?? sale.grossRevenue;
                      const balance =
                        sale.balanceDue ?? Math.max(0, total - (sale.totalPaid ?? 0));
                      return (
                        <tr key={sale.id}>
                          <td className="px-3 py-2">{formatDateLocal(sale.orderDate)}</td>
                          <td className="px-3 py-2">
                            <Link to={`/sales/${sale.id}`} className={detailLinkClass}>
                              {sale.orderNumber ?? sale.orderId ?? sale.productName}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatMoney(total, currency)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                            {balance > 0 ? formatMoney(balance, currency) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </DetailSection>

          <DetailSection
            icon={Wallet}
            iconTone="emerald"
            title="Customer ledger"
            description="Running balance from orders and payments — debit is amount owed, credit is amount received."
            headerAction={
              ledger.balanceDue > 0 ? (
                <Link to={`/payments/new?customer=${customer.id}`} className={`text-xs font-medium ${detailLinkClass}`}>
                  Record payment →
                </Link>
              ) : undefined
            }
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
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                          {entry.saleId ? (
                            <Link to={`/sales/${entry.saleId}`} className={detailLinkClass}>
                              {entry.description}
                            </Link>
                          ) : entry.paymentId ? (
                            <Link to={`/payments/${entry.paymentId}`} className={detailLinkClass}>
                              {entry.description}
                            </Link>
                          ) : (
                            entry.description
                          )}
                        </td>
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
        </>
      )}
    </EntityDetailShell>
  );
}
