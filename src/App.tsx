import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute';
import { Login } from './components/Login/Login';
import { Signup } from './components/Signup/Signup';
import { ForgotPassword } from './components/ForgotPassword/ForgotPassword';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { ProductFormPage } from './pages/Products/ProductFormPage';
import { ProductDetailPage } from './pages/Products/ProductDetailPage';
import { Products } from './pages/Products/Products';
import { SaleFormPage } from './pages/Sales/SaleFormPage';
import { SaleDetailPage } from './pages/Sales/SaleDetailPage';
import { Sales } from './pages/Sales/Sales';
import { ExpenseFormPage } from './pages/Expenses/ExpenseFormPage';
import { ExpenseDetailPage } from './pages/Expenses/ExpenseDetailPage';
import { Expenses } from './pages/Expenses/Expenses';
import { VendorFormPage } from './pages/Vendors/VendorFormPage';
import { VendorDetailPage } from './pages/Vendors/VendorDetailPage';
import { Vendors } from './pages/Vendors/Vendors';
import { Reports } from './pages/Reports/Reports';
import { ReportViewPage } from './pages/Reports/ReportViewPage';
import { TermsPage } from './pages/Terms/TermsPage';
import { TermsAcceptancePage } from './pages/Terms/TermsAcceptancePage';
import { Settings } from './pages/Settings/Settings';
import { About } from './pages/About/About';
import { Subscription } from './pages/Subscription/Subscription';
import { SubscriptionExpired } from './pages/SubscriptionExpired/SubscriptionExpired';

function AuthRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
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

        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/products/new" element={<ProtectedRoute><ProductFormPage /></ProtectedRoute>} />
        <Route path="/products/:productId/edit" element={<ProtectedRoute><ProductFormPage /></ProtectedRoute>} />
        <Route path="/products/:productId" element={<ProtectedRoute><ProductDetailPage /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
        <Route path="/sales/new" element={<ProtectedRoute><SaleFormPage /></ProtectedRoute>} />
        <Route path="/sales/:saleId/edit" element={<ProtectedRoute><SaleFormPage /></ProtectedRoute>} />
        <Route path="/sales/:saleId" element={<ProtectedRoute><SaleDetailPage /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
        <Route path="/expenses/new" element={<ProtectedRoute><ExpenseFormPage /></ProtectedRoute>} />
        <Route path="/expenses/:expenseId/edit" element={<ProtectedRoute><ExpenseFormPage /></ProtectedRoute>} />
        <Route path="/expenses/:expenseId" element={<ProtectedRoute><ExpenseDetailPage /></ProtectedRoute>} />
        <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
        <Route path="/vendors/new" element={<ProtectedRoute><VendorFormPage /></ProtectedRoute>} />
        <Route path="/vendors/:vendorId/edit" element={<ProtectedRoute><VendorFormPage /></ProtectedRoute>} />
        <Route path="/vendors/:vendorId" element={<ProtectedRoute><VendorDetailPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/reports/:reportId" element={<ProtectedRoute><ReportViewPage /></ProtectedRoute>} />
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
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
        <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />
        <Route path="/subscription-expired" element={<ProtectedRoute><SubscriptionExpired /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
