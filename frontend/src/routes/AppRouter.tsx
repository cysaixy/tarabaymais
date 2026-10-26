import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { FarmSelectionProvider } from "../context/FarmSelectionProvider";
import { GlobalFilterProvider } from "../context/filterContext";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { isMunicipalRole, useAuth } from "../context/authContext";

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
import FarmerHistoryHubPage from "../pages/farmer/FarmerHistoryHubPage";
import FarmerActivitiesHistoryPage from "../pages/farmer/FarmerActivitiesHistoryPage";
import FarmerObservationsHistoryPage from "../pages/farmer/FarmerObservationsHistoryPage";
import FarmerDisastersHistoryPage from "../pages/farmer/FarmerDisastersHistoryPage";
import FarmerSyncQueuePage from "../pages/farmer/FarmerSyncQueuePage";
import MyFarmsPage from "../pages/farmer/MyFarmsPage";
import AddFarmPage from "../pages/farmer/AddFarmPage";
import FarmDetailsPage from "../pages/farmer/FarmDetailsPage";
import OfficerDashboardPage from "../pages/officer/OfficerDashboardPage";
import TechnicianDashboardPage from "../pages/technician/TechnicianDashboardPage";

/**
 * PWA launches always begin at the manifest's `start_url` (`/`). Resolve that
 * launch from the restored Firebase session instead of unconditionally sending
 * a returning farmer to the phone-login screen. AuthProvider waits for both
 * Firebase persistence and the UID-scoped cached profile before this renders.
 */
const SessionHomeRedirect: React.FC = () => {
  const { user, profile, role } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (!profile || !role) return <Navigate to="/onboarding" replace />;
  return (
    <Navigate
      to={
        role === "TECHNICIAN"
          ? "/technician"
          : isMunicipalRole(role)
          ? "/officer/dashboard"
          : "/farmer"
      }
      replace
    />
  );
};

const RootRedirect: React.FC = () => {
  const { user, profile, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-teal-500" />
          <p className="text-xs tracking-wide">Kinukuha ang sesyon...</p>
        </div>
      </div>
    );
  }
  if (user && profile && role) {
    return (
      <Navigate
        to={
          role === "TECHNICIAN"
            ? "/technician"
            : isMunicipalRole(role)
            ? "/officer/dashboard"
            : "/farmer"
        }
        replace
      />
    );
  }
  return <Navigate to="/login" replace />;
};

// ---------------------------------------------------------------------------
// Public routes (no authentication required)
// ---------------------------------------------------------------------------
const publicRoutes = (
  <>
    <Route path="/" element={<RootRedirect />} />
    <Route path="/login" element={<FarmerLoginPage />} />
    <Route path="/officer/login" element={<OfficerLoginPage />} />
    {/* Onboarding handles its own Firebase phone auth before registering. */}
    <Route path="/onboarding" element={<FarmerOnboardingPage />} />
    {/* Legacy alias kept so existing links to /register still work. */}
    <Route path="/register" element={<Navigate to="/onboarding" replace />} />
  </>
);

// ---------------------------------------------------------------------------
// Farmer routes (role: FARMER)
// ---------------------------------------------------------------------------
const farmerRoutes = (
  <>
    <Route path="/farmer" element={<FarmerDashboardPage />} />
    <Route path="/farmer/chat" element={<FarmerChatPage />} />
    <Route path="/farmer/observation" element={<FarmerObservationPage />} />
    <Route path="/farmer/disaster" element={<FarmerDisasterReportPage />} />
    <Route
      path="/farmer/expert-request"
      element={<FarmerExpertRequestPage />}
    />
    <Route path="/farmer/scanner" element={<FarmerScannerPage />} />
    <Route path="/farmer/activity" element={<FarmerActivityPage />} />
    {/* History Hub + Sub-pages */}
    <Route path="/farmer/history" element={<FarmerHistoryHubPage />} />
    <Route path="/farmer/history/activities" element={<FarmerActivitiesHistoryPage />} />
    <Route path="/farmer/history/observations" element={<FarmerObservationsHistoryPage />} />
    <Route path="/farmer/history/disasters" element={<FarmerDisastersHistoryPage />} />
    <Route path="/farmer/history/sync-queue" element={<FarmerSyncQueuePage />} />
    <Route path="/farmer/farms" element={<MyFarmsPage />} />
    {/* `/new` must precede the `:farmId` param route so it is not captured. */}
    <Route path="/farmer/farms/new" element={<AddFarmPage />} />
    <Route path="/farmer/farms/:farmId" element={<FarmDetailsPage />} />
  </>
);

// ---------------------------------------------------------------------------
// Municipal routes (roles: TECHNICIAN, OFFICER)
// Technicians and officers share the same municipal portal surface; the
// dashboard component adapts its content to the signed-in role.
// ---------------------------------------------------------------------------
const municipalRoutes = (
  <>
    <Route path="/technician" element={<TechnicianDashboardPage />} />
    <Route
      path="/technician/dashboard"
      element={<Navigate to="/technician" replace />}
    />
    <Route path="/officer/dashboard" element={<OfficerDashboardPage />} />
    {/* Legacy municipal URLs */}
    <Route
      path="/officer/cases"
      element={<Navigate to="/officer/dashboard" replace />}
    />
    <Route
      path="/officer/exports"
      element={<Navigate to="/officer/dashboard" replace />}
    />
  </>
);

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* The PWA manifest starts the app at `/`; restore the correct home. */}
      <Route path="/" element={<SessionHomeRedirect />} />
      {publicRoutes}

      {/* Farmer-only area, wrapped in the shared farm/cycle selection context. */}
      <Route element={<ProtectedRoute allowedRoles={["FARMER"]} />}>
        <Route
          element={
            <ErrorBoundary area="Farmer Portal">
              <FarmSelectionProvider>
                <Outlet />
              </FarmSelectionProvider>
            </ErrorBoundary>
          }
        >
          {farmerRoutes}
        </Route>
      </Route>

      {/* Technician/Officer municipal area */}
      <Route
        element={<ProtectedRoute allowedRoles={["TECHNICIAN", "OFFICER"]} />}
      >
        <Route
          element={
            <ErrorBoundary area="Officer Portal">
              <GlobalFilterProvider>
                <Outlet />
              </GlobalFilterProvider>
            </ErrorBoundary>
          }
        >
          {municipalRoutes}
        </Route>
      </Route>

      {/* A stale saved route should recover to the current user's home. */}
      <Route path="*" element={<SessionHomeRedirect />} />
    </Routes>
  );
};
