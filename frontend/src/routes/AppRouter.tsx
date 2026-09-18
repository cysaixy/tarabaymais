import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";

import AuthPage from "../pages/auth/AuthPage";
import FarmerDashboardPage from "../pages/farmer/FarmerDashboardPage";
import TechnicianDashboardPage from "../pages/technician/TechnicianDashboardPage";

// ---------------------------------------------------------------------------
// Public routes (no authentication required)
// ---------------------------------------------------------------------------
const publicRoutes = (
  <>
    <Route path="/login" element={<AuthPage />} />
    <Route path="/register" element={<AuthPage />} />
  </>
);

// ---------------------------------------------------------------------------
// Farmer routes (role: farmer)
// ---------------------------------------------------------------------------
const farmerRoutes = (
  <>
    <Route path="/farmer" element={<FarmerDashboardPage />} />
  </>
);

// ---------------------------------------------------------------------------
// Technician routes (role: technician)
// ---------------------------------------------------------------------------
const technicianRoutes = (
  <>
    <Route path="/technician" element={<TechnicianDashboardPage />} />
  </>
);

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {publicRoutes}

      {/* Farmer-only area */}
      <Route element={<ProtectedRoute allowedRoles={["farmer"]} />}>
        {farmerRoutes}
      </Route>

      {/* Technician-only area */}
      <Route element={<ProtectedRoute allowedRoles={["technician"]} />}>
        {technicianRoutes}
      </Route>

      {/* Anything else falls back to the login screen */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};
