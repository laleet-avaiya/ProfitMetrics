import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Wallet } from 'lucide-react';
import { EntityDetailShell } from '../../components/DetailPage/EntityDetailShell';
import { DetailField, DetailGrid, detailLinkClass } from '../../components/DetailPage/DetailField';
import { DetailMetaChip, DetailMetaRow, DetailNotes } from '../../components/DetailPage/DetailMeta';
import { DetailSection } from '../../components/DetailPage/DetailSection';
import { DetailStatStrip } from '../../components/DetailPage/DetailStatStrip';
import { Button } from '../../components/Button/Button';
import { useAuth } from '../../hooks/useAuth';
import { useEntityDetail } from '../../hooks/useEntityDetail';
import { paymentKindLabel } from '../../constants/paymentKinds';
import { paymentModeLabel } from '../../constants/paymentModes';
import { firestoreService } from '../../services/firestore';
import { PaymentKind } from '../../types';
import { formatDateLocal } from '../../utils/date';
import { formatMoney } from '../../utils/profit';

export function PaymentDetailPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { company } = useAuth();
  const currency = company?.currency ?? 'AED';

  const { entity: payment, loading, notFound } = useEntityDetail({
    id: paymentId,
    fetch: firestoreService.payments.get,
    errorMessage: 'Failed to load payment',
  });

  return (
    <EntityDetailShell
      loading={loading}
      loadingLabel="Loading payment…"
      loadingIcon={Wallet}
      notFound={notFound}
      notFoundTitle="Payment not found"
      notFoundDescription="This payment may have been deleted."
      backTo="/payments"
      backLabel="Back to payments"
      title={payment ? formatMoney(payment.amount, currency) : 'Payment'}
      description={payment ? paymentKindLabel(payment.kind) : undefined}
      meta={
        payment ? (
          <DetailMetaRow>
            <DetailMetaChip tone="indigo">{formatDateLocal(payment.paymentDate)}</DetailMetaChip>
            <DetailMetaChip tone="gray">{paymentKindLabel(payment.kind)}</DetailMetaChip>
          </DetailMetaRow>
        ) : undefined
      }
      actions={
        payment ? (
          <Button variant="outline" onClick={() => navigate(`/payments/${payment.id}/edit`)}>
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
        ) : null
      }
    >
      {payment && (
        <>
          <DetailStatStrip
            stats={[
              {
                label: 'Amount received',
                value: formatMoney(payment.amount, currency),
                icon: Wallet,
                tone: 'emerald',
                valueClassName: 'text-emerald-700 dark:text-emerald-400',
              },
            ]}
          />
          <DetailSection icon={Wallet} iconTone="emerald" title="Payment details">
            <DetailGrid columns={2}>
              <DetailField label="Type" value={paymentKindLabel(payment.kind)} />
              <DetailField label="Payment mode" value={paymentModeLabel(payment.paymentMode)} />
              <DetailField label="Date" value={formatDateLocal(payment.paymentDate)} />
              <DetailField label="Reference" value={payment.reference} />
              {payment.kind === PaymentKind.MARKETPLACE_PAYOUT ? (
                <DetailField label="Platform" value={payment.platform} />
              ) : null}
              {payment.customerName ? (
                <DetailField
                  label="Customer"
                  value={
                    payment.customerId ? (
                      <Link to={`/customers/${payment.customerId}`} className={detailLinkClass}>
                        {payment.customerName}
                      </Link>
                    ) : (
                      payment.customerName
                    )
                  }
                />
              ) : null}
              {payment.invoiceId ? (
                <DetailField
                  label="Invoice"
                  value={
                    <Link to={`/invoices/${payment.invoiceId}`} className={detailLinkClass}>
                      {payment.invoiceNumber ?? 'View invoice'}
                    </Link>
                  }
                />
              ) : null}
            </DetailGrid>
            {payment.notes ? <DetailNotes>{payment.notes}</DetailNotes> : null}
          </DetailSection>
        </>
      )}
    </EntityDetailShell>
  );
}
