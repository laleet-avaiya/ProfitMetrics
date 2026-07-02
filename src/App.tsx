import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute';
import { WriteRoute, AdminRoute, CompanyAdminRoute } from './components/ProtectedRoute/RoleRoutes';
import { Login } from './components/Login/Login';
import { Signup } from './components/Signup/Signup';
import { ForgotPassword } from './components/ForgotPassword/ForgotPassword';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { ProductFormPage } from './pages/Products/ProductFormPage';
import { ProductDetailPage } from './pages/Products/ProductDetailPage';
import { Products } from './pages/Products/Products';
import { SaleFormPage } from './pages/Sales/SaleFormPage';
import { SaleDetailPage } from './pages/Sales/SaleDetailPage';
import { SalePrintPage, InvoicePrintPage } from './pages/Sales/SalePrintPage';
import { Sales } from './pages/Sales/Sales';
import { ExpenseFormPage } from './pages/Expenses/ExpenseFormPage';
import { ExpenseDetailPage } from './pages/Expenses/ExpenseDetailPage';
import { Expenses } from './pages/Expenses/Expenses';
import { VendorFormPage } from './pages/Vendors/VendorFormPage';
import { VendorDetailPage } from './pages/Vendors/VendorDetailPage';
import { Vendors } from './pages/Vendors/Vendors';
import { Customers } from './pages/Customers/Customers';
import { CustomerFormPage } from './pages/Customers/CustomerFormPage';
import { CustomerDetailPage } from './pages/Customers/CustomerDetailPage';
import { InvoiceFormPage } from './pages/Invoices/InvoiceFormPage';
import { InvoiceDetailPage } from './pages/Invoices/InvoiceDetailPage';
import { InvoicesRedirect } from './pages/Sales/InvoicesRedirect';
import { Payments } from './pages/Payments/Payments';
import { PaymentFormPage } from './pages/Payments/PaymentFormPage';
import { PaymentDetailPage } from './pages/Payments/PaymentDetailPage';
import { Purchases } from './pages/Purchases/Purchases';
import { PurchaseFormPage } from './pages/Purchases/PurchaseFormPage';
import { PurchaseDetailPage } from './pages/Purchases/PurchaseDetailPage';
import { Reports } from './pages/Reports/Reports';
import { TermsPage } from './pages/Terms/TermsPage';
import { TermsAcceptancePage } from './pages/Terms/TermsAcceptancePage';
import { Configuration } from './pages/Configuration/Configuration';
import { Settings } from './pages/Settings/Settings';
import { About } from './pages/About/About';
import { Subscription } from './pages/Subscription/Subscription';
import { SubscriptionExpired } from './pages/SubscriptionExpired/SubscriptionExpired';
import { AIAssistantPage } from './pages/AIAssistant/AIAssistantPage';
import { TeamPage } from './pages/Team/TeamPage';
import { NoCompanyPage } from './pages/NoCompany/NoCompanyPage';
import { CreateCompanyPage } from './pages/CreateCompany/CreateCompanyPage';
import { LoadingView } from './components/AppLoader/AppLoader';

function AuthRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <LoadingView message="Loading…" size="lg" className="min-h-screen gap-4" />
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <>
              <AuthRedirect />
              <Login />
            </>
          }
        />
        <Route
          path="/signup"
          element={
            <>
              <AuthRedirect />
              <Signup />
            </>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <>
              <AuthRedirect />
              <ForgotPassword />
            </>
          }
        />

        <Route path="/no-company" element={<ProtectedRoute requireLegalConsent={false}><NoCompanyPage /></ProtectedRoute>} />
        <Route path="/create-company" element={<ProtectedRoute requireLegalConsent={false}><CreateCompanyPage /></ProtectedRoute>} />

        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/products/new" element={<WriteRoute><ProductFormPage /></WriteRoute>} />
        <Route path="/products/:productId/edit" element={<WriteRoute><ProductFormPage /></WriteRoute>} />
        <Route path="/products/:productId" element={<ProtectedRoute><ProductDetailPage /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
        <Route path="/sales/new" element={<WriteRoute><SaleFormPage /></WriteRoute>} />
        <Route path="/sales/:saleId/edit" element={<WriteRoute><SaleFormPage /></WriteRoute>} />
        <Route path="/sales/:saleId/print" element={<ProtectedRoute><SalePrintPage /></ProtectedRoute>} />
        <Route path="/sales/:saleId" element={<ProtectedRoute><SaleDetailPage /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><InvoicesRedirect /></ProtectedRoute>} />
        <Route path="/invoices/new" element={<WriteRoute><InvoiceFormPage /></WriteRoute>} />
        <Route path="/invoices/:invoiceId/edit" element={<WriteRoute><InvoiceFormPage /></WriteRoute>} />
        <Route path="/invoices/:invoiceId/print" element={<ProtectedRoute><InvoicePrintPage /></ProtectedRoute>} />
        <Route path="/invoices/:invoiceId" element={<ProtectedRoute><InvoiceDetailPage /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
        <Route path="/payments/new" element={<WriteRoute><PaymentFormPage /></WriteRoute>} />
        <Route path="/payments/:paymentId/edit" element={<WriteRoute><PaymentFormPage /></WriteRoute>} />
        <Route path="/payments/:paymentId" element={<ProtectedRoute><PaymentDetailPage /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
        <Route path="/expenses/new" element={<WriteRoute><ExpenseFormPage /></WriteRoute>} />
        <Route path="/expenses/:expenseId/edit" element={<WriteRoute><ExpenseFormPage /></WriteRoute>} />
        <Route path="/expenses/:expenseId" element={<ProtectedRoute><ExpenseDetailPage /></ProtectedRoute>} />
        <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
        <Route path="/vendors/new" element={<WriteRoute><VendorFormPage /></WriteRoute>} />
        <Route path="/vendors/:vendorId/edit" element={<WriteRoute><VendorFormPage /></WriteRoute>} />
        <Route path="/vendors/:vendorId" element={<ProtectedRoute><VendorDetailPage /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
        <Route path="/customers/new" element={<WriteRoute><CustomerFormPage /></WriteRoute>} />
        <Route path="/customers/:customerId/edit" element={<WriteRoute><CustomerFormPage /></WriteRoute>} />
        <Route path="/customers/:customerId" element={<ProtectedRoute><CustomerDetailPage /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute><Purchases /></ProtectedRoute>} />
        <Route path="/purchases/new" element={<WriteRoute><PurchaseFormPage /></WriteRoute>} />
        <Route path="/purchases/:purchaseId/edit" element={<WriteRoute><PurchaseFormPage /></WriteRoute>} />
        <Route path="/purchases/:purchaseId" element={<ProtectedRoute><PurchaseDetailPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/reports/:reportId" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistantPage /></ProtectedRoute>} />
        <Route path="/team" element={<AdminRoute><TeamPage /></AdminRoute>} />
        <Route
          path="/terms/accept"
          element={
            <ProtectedRoute requireLegalConsent={false}>
              <TermsAcceptancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/terms"
          element={
            <ProtectedRoute requireLegalConsent={false}>
              <TermsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/configuration" element={<CompanyAdminRoute><Configuration /></CompanyAdminRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute requiredPermission="manage_subscription"><Subscription /></ProtectedRoute>} />
        <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />
        <Route path="/subscription-expired" element={<ProtectedRoute><SubscriptionExpired /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
