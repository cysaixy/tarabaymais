import { BrowserRouter, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import { AppRouter } from "./routes/AppRouter";
import Header from "./components/Header";
import Footer from "./components/Footer";

function AppShell() {
  const location = useLocation();

  // Dynamic Layout Rule Engine
  // Auth screens render standalone without the global header/footer chrome.
  const isAuthRoute =
    location.pathname.startsWith("/auth") ||
    location.pathname === "/login" ||
    location.pathname === "/register";

  const hideGlobalLayout = isAuthRoute;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-slate-100 selection:bg-teal-500/30">
      {!hideGlobalLayout && <Header />}

      <div className="flex flex-1 flex-col">
        <AppRouter />
      </div>

      {!hideGlobalLayout && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
