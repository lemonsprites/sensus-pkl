import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "@/auth/AuthProvider";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardPage from "@/pages/DashboardPage";
import HierarchyPage from "@/pages/HierarchyPage";
import ImportPage from "@/pages/ImportPage";
import LabelPage from "@/pages/LabelPage";
import LoginPage from "@/pages/LoginPage";
import ProfilPage from "@/pages/ProfilPage";
import ScanPage from "@/pages/ScanPage";
import SensusRuangPage from "@/pages/SensusRuangPage";
import UsersPage from "@/pages/UsersPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/hierarki" replace />} />
              <Route path="/hierarki" element={<HierarchyPage />} />
              <Route path="/sensus/:ruangId" element={<SensusRuangPage />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/profil" element={<ProfilPage />} />

              <Route element={<ProtectedRoute roles={["ADMIN", "SUPERADMIN"]} />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/label" element={<LabelPage />} />
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/hierarki" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
