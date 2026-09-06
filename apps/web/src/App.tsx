import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { AccountsPage } from "./pages/AccountsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AuditPage } from "./pages/AuditPage";
import { BranchesPage } from "./pages/BranchesPage";
import { CalendarPage } from "./pages/CalendarPage";
import { CollectionPage } from "./pages/CollectionPage";
import { DashboardPage } from "./pages/DashboardPage";
import { JournalsPage } from "./pages/JournalsPage";
import { LoansPage } from "./pages/LoansPage";
import { LoginPage } from "./pages/LoginPage";
import { MembersPage } from "./pages/MembersPage";
import { PayrollPage } from "./pages/PayrollPage";
import { PersonnelPage } from "./pages/PersonnelPage";
import { PeriodsPage } from "./pages/PeriodsPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { RolesPage } from "./pages/RolesPage";
import { SavingsPage } from "./pages/SavingsPage";
import { SetupPage } from "./pages/SetupPage";
import { ShuPage } from "./pages/ShuPage";
import { TenantsPage } from "./pages/TenantsPage";
import { UsersPage } from "./pages/UsersPage";
import { WorkspaceProvider } from "./lib/workspace";
import { Shell } from "./ui/Shell";

function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Memuat sesi…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Guard>
            <WorkspaceProvider>
              <Shell />
            </WorkspaceProvider>
          </Guard>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tenants" element={<TenantsPage />} />
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/journals" element={<JournalsPage />} />
        <Route path="/periods" element={<PeriodsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/shu" element={<ShuPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/savings" element={<SavingsPage />} />
        <Route path="/loans" element={<LoansPage />} />
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/personnel" element={<PersonnelPage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Route>
    </Routes>
  );
}
