import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";

const linkBase =
  "px-3 py-2 rounded-md text-sm font-medium transition-colors";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `${linkBase} ${
    isActive
      ? "bg-teal-500/15 text-teal-300"
      : "text-slate-300 hover:text-white hover:bg-slate-800"
  }`;

const Header = () => {
  const { user, profile, role, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : (user?.phoneNumber ?? undefined);

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  const isMunicipal = role === "TECHNICIAN" || role === "OFFICER";
  const homePath = isMunicipal ? "/officer/dashboard" : "/farmer";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to={homePath} className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-500 font-bold text-slate-950">
            T
          </span>
          <span className="text-lg font-semibold tracking-tight">
            TarabayMais
          </span>
        </Link>

        {user && (
          <nav className="flex items-center gap-1">
            {role === "FARMER" && (
              <>
                <NavLink to="/farmer" end className={navClass}>
                  Home
                </NavLink>
                <NavLink to="/farmer/scanner" className={navClass}>
                  Scanner
                </NavLink>
                <NavLink to="/farmer/chat" className={navClass}>
                  Chat
                </NavLink>
              </>
            )}
            {isMunicipal && (
              <>
                <NavLink to="/officer/dashboard" end className={navClass}>
                  Dashboard
                </NavLink>
                <NavLink to="/officer/cases" className={navClass}>
                  Cases
                </NavLink>
                <NavLink to="/officer/exports" className={navClass}>
                  Exports
                </NavLink>
              </>
            )}

            <span className="mx-2 hidden text-sm text-slate-400 sm:inline">
              {displayName ?? "Signed in"}
              {role && (
                <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs uppercase tracking-wide text-teal-300">
                  {role}
                </span>
              )}
            </span>

            <button
              onClick={() => setConfirmLogout(true)}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
            >
              Log out
            </button>
          </nav>
        )}
      </div>

      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 p-6 shadow-2xl ring-1 ring-white/10">
            <h3 className="text-lg font-bold text-white">Confirm logout</h3>
            <p className="mt-2 text-sm text-slate-300">
              Are you sure you want to log out? You will need to sign in again.
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                disabled={loggingOut}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loggingOut ? "Logging out..." : "Yes, log out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
