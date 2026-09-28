import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";

import FarmerLoginPage from "../pages/auth/FarmerLoginPage";
import FarmerOnboardingPage from "../pages/auth/FarmerOnboardingPage";
import OfficerLoginPage from "../pages/auth/OfficerLoginPage";
import FarmerDashboardPage from "../pages/farmer/FarmerDashboardPage";
import FarmerChatPage from "../pages/farmer/FarmerChatPage";
import FarmerObservationPage from "../pages/farmer/FarmerObservationPage";
import FarmerDisasterReportPage from "../pages/farmer/FarmerDisasterReportPage";
import FarmerExpertRequestPage from "../pages/farmer/FarmerExpertRequestPage";
import FarmerScannerPage from "../pages/farmer/FarmerScannerPage";
import FarmerActivityPage from "../pages/farmer/FarmerActivityPage";
import FarmerHistoryPage from "../pages/farmer/FarmerHistoryPage";
import TechnicianDashboardPage from "../pages/technician/TechnicianDashboardPage";

// ---------------------------------------------------------------------------
// Public routes (no authentication required)
// ---------------------------------------------------------------------------
const publicRoutes = (
  <>
    <Route path="/login" element={<FarmerLoginPage />} />
    <Route path="/onboarding" element={<FarmerOnboardingPage />} />
    <Route path="/officer/login" element={<OfficerLoginPage />} />
    <Route path="/register" element={<FarmerOnboardingPage />} />
  </>
);

// ---------------------------------------------------------------------------
// Farmer routes (role: farmer)
// ---------------------------------------------------------------------------
const farmerRoutes = (
  <>
    <Route path="/farmer" element={<FarmerDashboardPage />} />
    <Route path="/farmer/chat" element={<FarmerChatPage />} />
    <Route path="/farmer/observation" element={<FarmerObservationPage />} />
    <Route path="/farmer/disaster" element={<FarmerDisasterReportPage />} />
    <Route path="/farmer/expert-request" element={<FarmerExpertRequestPage />} />
    <Route path="/farmer/scanner" element={<FarmerScannerPage />} />
    <Route path="/farmer/activity" element={<FarmerActivityPage />} />
    <Route path="/farmer/history" element={<FarmerHistoryPage />} />
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
