import { Navigate, useSearchParams } from 'react-router-dom';

/** Preserve customer filter when redirecting legacy /invoices URLs. */
export function InvoicesRedirect() {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams();
  next.set('channel', 'offline');
  const customer = searchParams.get('customer');
  if (customer) next.set('customer', customer);
  return <Navigate to={`/sales?${next.toString()}`} replace />;
}
