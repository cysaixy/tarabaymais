import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";

const linkBase =
  "px-3 py-2 rounded-md text-sm font-medium transition-colors";

const Header = () => {
  const { user, profile, role, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : user?.email;

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const homePath = role === "technician" ? "/technician" : "/farmer";

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
            {role === "farmer" && (
              <NavLink
                to="/farmer"
                className={({ isActive }) =>
                  `${linkBase} ${
                    isActive
                      ? "bg-teal-500/15 text-teal-300"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`
                }
              >
                Farmer Home
              </NavLink>
            )}
            {role === "technician" && (
              <NavLink
                to="/technician"
                className={({ isActive }) =>
                  `${linkBase} ${
                    isActive
                      ? "bg-teal-500/15 text-teal-300"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`
                }
              >
                Technician Home
              </NavLink>
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
              onClick={handleLogout}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
            >
              Log out
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
