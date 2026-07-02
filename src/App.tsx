import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute';
import { ModuleRoute, ModuleWriteRoute } from './components/ProtectedRoute/RoleRoutes';
import { AppModule } from './constants/permissions';
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
import { CompaniesPage } from './pages/Companies/CompaniesPage';
import { CreateCompanyPage } from './pages/Companies/CreateCompanyPage';
import { LoadingView } from './components/AppLoader/AppLoader';

function AuthRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <LoadingView message="Loading…" size="lg" className="min-h-screen gap-4" />
    );
  }

  if (user) {
    return <Navigate to="/companies" replace />;
  }

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<><AuthRedirect /><Login /></>} />
        <Route path="/signup" element={<><AuthRedirect /><Signup /></>} />
        <Route path="/forgot-password" element={<><AuthRedirect /><ForgotPassword /></>} />

        <Route path="/companies" element={<ProtectedRoute requireLegalConsent={false} requireCompany={false}><CompaniesPage /></ProtectedRoute>} />
        <Route path="/companies/new" element={<ProtectedRoute requireLegalConsent={false} requireCompany={false}><CreateCompanyPage /></ProtectedRoute>} />

        <Route path="/" element={<ModuleRoute module={AppModule.DASHBOARD}><Dashboard /></ModuleRoute>} />
        <Route path="/products" element={<ModuleRoute module={AppModule.PRODUCTS}><Products /></ModuleRoute>} />
        <Route path="/products/new" element={<ModuleWriteRoute module={AppModule.PRODUCTS} action="create"><ProductFormPage /></ModuleWriteRoute>} />
        <Route path="/products/:productId/edit" element={<ModuleWriteRoute module={AppModule.PRODUCTS} action="update"><ProductFormPage /></ModuleWriteRoute>} />
        <Route path="/products/:productId" element={<ModuleRoute module={AppModule.PRODUCTS}><ProductDetailPage /></ModuleRoute>} />
        <Route path="/sales" element={<ModuleRoute module={AppModule.SALES}><Sales /></ModuleRoute>} />
        <Route path="/sales/new" element={<ModuleWriteRoute module={AppModule.SALES} action="create"><SaleFormPage /></ModuleWriteRoute>} />
        <Route path="/sales/:saleId/edit" element={<ModuleWriteRoute module={AppModule.SALES} action="update"><SaleFormPage /></ModuleWriteRoute>} />
        <Route path="/sales/:saleId/print" element={<ModuleRoute module={AppModule.SALES}><SalePrintPage /></ModuleRoute>} />
        <Route path="/sales/:saleId" element={<ModuleRoute module={AppModule.SALES}><SaleDetailPage /></ModuleRoute>} />
        <Route path="/invoices" element={<ModuleRoute module={AppModule.INVOICES}><InvoicesRedirect /></ModuleRoute>} />
        <Route path="/invoices/new" element={<ModuleWriteRoute module={AppModule.INVOICES} action="create"><InvoiceFormPage /></ModuleWriteRoute>} />
        <Route path="/invoices/:invoiceId/edit" element={<ModuleWriteRoute module={AppModule.INVOICES} action="update"><InvoiceFormPage /></ModuleWriteRoute>} />
        <Route path="/invoices/:invoiceId/print" element={<ModuleRoute module={AppModule.INVOICES}><InvoicePrintPage /></ModuleRoute>} />
        <Route path="/invoices/:invoiceId" element={<ModuleRoute module={AppModule.INVOICES}><InvoiceDetailPage /></ModuleRoute>} />
        <Route path="/payments" element={<ModuleRoute module={AppModule.PAYMENTS}><Payments /></ModuleRoute>} />
        <Route path="/payments/new" element={<ModuleWriteRoute module={AppModule.PAYMENTS} action="create"><PaymentFormPage /></ModuleWriteRoute>} />
        <Route path="/payments/:paymentId/edit" element={<ModuleWriteRoute module={AppModule.PAYMENTS} action="update"><PaymentFormPage /></ModuleWriteRoute>} />
        <Route path="/payments/:paymentId" element={<ModuleRoute module={AppModule.PAYMENTS}><PaymentDetailPage /></ModuleRoute>} />
        <Route path="/expenses" element={<ModuleRoute module={AppModule.EXPENSES}><Expenses /></ModuleRoute>} />
        <Route path="/expenses/new" element={<ModuleWriteRoute module={AppModule.EXPENSES} action="create"><ExpenseFormPage /></ModuleWriteRoute>} />
        <Route path="/expenses/:expenseId/edit" element={<ModuleWriteRoute module={AppModule.EXPENSES} action="update"><ExpenseFormPage /></ModuleWriteRoute>} />
        <Route path="/expenses/:expenseId" element={<ModuleRoute module={AppModule.EXPENSES}><ExpenseDetailPage /></ModuleRoute>} />
        <Route path="/vendors" element={<ModuleRoute module={AppModule.VENDORS}><Vendors /></ModuleRoute>} />
        <Route path="/vendors/new" element={<ModuleWriteRoute module={AppModule.VENDORS} action="create"><VendorFormPage /></ModuleWriteRoute>} />
        <Route path="/vendors/:vendorId/edit" element={<ModuleWriteRoute module={AppModule.VENDORS} action="update"><VendorFormPage /></ModuleWriteRoute>} />
        <Route path="/vendors/:vendorId" element={<ModuleRoute module={AppModule.VENDORS}><VendorDetailPage /></ModuleRoute>} />
        <Route path="/customers" element={<ModuleRoute module={AppModule.CUSTOMERS}><Customers /></ModuleRoute>} />
        <Route path="/customers/new" element={<ModuleWriteRoute module={AppModule.CUSTOMERS} action="create"><CustomerFormPage /></ModuleWriteRoute>} />
        <Route path="/customers/:customerId/edit" element={<ModuleWriteRoute module={AppModule.CUSTOMERS} action="update"><CustomerFormPage /></ModuleWriteRoute>} />
        <Route path="/customers/:customerId" element={<ModuleRoute module={AppModule.CUSTOMERS}><CustomerDetailPage /></ModuleRoute>} />
        <Route path="/purchases" element={<ModuleRoute module={AppModule.PURCHASES}><Purchases /></ModuleRoute>} />
        <Route path="/purchases/new" element={<ModuleWriteRoute module={AppModule.PURCHASES} action="create"><PurchaseFormPage /></ModuleWriteRoute>} />
        <Route path="/purchases/:purchaseId/edit" element={<ModuleWriteRoute module={AppModule.PURCHASES} action="update"><PurchaseFormPage /></ModuleWriteRoute>} />
        <Route path="/purchases/:purchaseId" element={<ModuleRoute module={AppModule.PURCHASES}><PurchaseDetailPage /></ModuleRoute>} />
        <Route path="/reports" element={<ModuleRoute module={AppModule.REPORTS}><Reports /></ModuleRoute>} />
        <Route path="/reports/:reportId" element={<ModuleRoute module={AppModule.REPORTS}><Reports /></ModuleRoute>} />
        <Route path="/ai-assistant" element={<ModuleRoute module={AppModule.AI_ASSISTANT}><AIAssistantPage /></ModuleRoute>} />
        <Route path="/team" element={<ModuleRoute module={AppModule.TEAM}><TeamPage /></ModuleRoute>} />
        <Route path="/terms/accept" element={<ProtectedRoute requireLegalConsent={false} requireCompany={false}><TermsAcceptancePage /></ProtectedRoute>} />
        <Route path="/terms" element={<ProtectedRoute requireLegalConsent={false}><TermsPage /></ProtectedRoute>} />
        <Route path="/configuration" element={<ModuleRoute module={AppModule.CONFIGURATION}><Configuration /></ModuleRoute>} />
        <Route path="/settings" element={<ModuleRoute module={AppModule.SETTINGS}><Settings /></ModuleRoute>} />
        <Route path="/subscription" element={<ProtectedRoute requireCompany={false} module={AppModule.SUBSCRIPTION}><Subscription /></ProtectedRoute>} />
        <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />
        <Route path="/subscription-expired" element={<ProtectedRoute><SubscriptionExpired /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
