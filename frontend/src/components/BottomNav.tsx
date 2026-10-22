/**
 * BottomNav — Shared farmer bottom navigation.
 *
 * Mobile-first thumb-reach bar with large ≥48px tap targets, bold active
 * state, and an optional pending badge on History. Labels are in Filipino.
 *
 * @param active   current route key ("home" | "scanner" | "chat" | "history")
 * @param badgeCount pending offline queue count shown on the History tab
 */
import { useNavigate } from "react-router-dom";
import { Home, Scan, MessageSquare, Clock } from "lucide-react";

type NavKey = "home" | "scanner" | "chat" | "history";

interface BottomNavItem {
  key: NavKey;
  label: string;
  path: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

const ITEMS: BottomNavItem[] = [
  { key: "home", label: "Tahanan", path: "/farmer", icon: Home },
  { key: "scanner", label: "Scanner", path: "/farmer/scanner", icon: Scan },
  { key: "chat", label: "AI Chat", path: "/farmer/chat", icon: MessageSquare },
  { key: "history", label: "History", path: "/farmer/history", icon: Clock },
];

interface BottomNavProps {
  active?: NavKey;
  badgeCount?: number;
  className?: string;
}

export function BottomNav({ active = "home", badgeCount = 0, className }: BottomNavProps) {
  const navigate = useNavigate();
  const hasBadge = badgeCount > 0;

  return (
    <nav
      className={`fixed md:sticky bottom-0 left-0 right-0 max-w-full md:max-w-md lg:max-w-lg mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 flex items-center justify-around gap-1 z-30 shadow-lg ${className ?? ""}`}
    >
      {ITEMS.map((item) => {
        const isActive = active === item.key;
        const showBadge = item.key === "history" && hasBadge;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(item.path)}
            className={`relative flex flex-col items-center justify-center gap-1 px-2 py-1.5 min-h-[52px] rounded-2xl transition-all duration-200 active:scale-95 cursor-pointer ${
              isActive
                ? "bg-emerald-50 text-emerald-800 font-black text-[11px] shadow-sm border border-emerald-100"
                : "text-slate-400 hover:text-emerald-700 hover:bg-emerald-50/50 font-medium text-[11px]"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <item.icon
                className={`w-5 h-5 transition ${
                  isActive ? "text-emerald-800 stroke-[2.4]" : "text-slate-400 stroke-2"
                }`}
              />
              {showBadge && (
                <span
                  className={`absolute -top-1 -right-1 bg-amber-500 text-amber-950 font-black text-[9px] ${
                    badgeCount > 9 ? "w-5 h-5" : "w-4 h-4"
                  } rounded-full flex items-center justify-center z-10`}
                >
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </div>
            <span className={`leading-none ${isActive ? "font-black" : "font-medium"}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
