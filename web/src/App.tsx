import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "@/auth/AuthProvider";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import ProfilPage from "@/pages/ProfilPage";
import UsersPage from "@/pages/UsersPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/profil" replace />} />
              <Route path="/profil" element={<ProfilPage />} />

              <Route element={<ProtectedRoute roles={["ADMIN", "SUPERADMIN"]} />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/profil" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
