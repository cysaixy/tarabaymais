import React, { useEffect, useRef, useState } from "react";
import {
  UserCheck,
  X,
  ChevronRight,
} from "lucide-react";

export interface AccountMenuItem {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  itemBg?: string;
  titleColor?: string;
  subtitleColor?: string;
  chevronColor?: string;
  badge?: number | string;
  badgeBg?: string;
  onClick: () => void;
}

export interface AccountSheetProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  profileName: string;
  profileRoleSubtitle: string;
  profileInitials: string;
  menuItems: AccountMenuItem[];
  footerText?: string;
}

export const AccountSheet: React.FC<AccountSheetProps> = ({
  isOpen,
  onClose,
  triggerRef,
  profileName,
  profileRoleSubtitle,
  profileInitials,
  menuItems,
  footerText = "TarabayMais v1.0.0 \u00b7 DA Region II",
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Position popover under trigger on desktop
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !triggerRef?.current) return;
    const updatePos = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setPopoverPos({
        top: Math.round(rect.bottom + 8),
        right: Math.max(16, Math.round(window.innerWidth - rect.right)),
      });
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos);
    };
  }, [isOpen, triggerRef]);

  // Close on Escape & trap/return focus
  useEffect(() => {
    if (!isOpen) return;

    // Focus close button on open
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        triggerRef?.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <>
      {/* Dim backdrop (mobile & desktop backdrop) */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/60 transition-opacity"
        aria-hidden="true"
        onClick={() => {
          onClose();
          triggerRef?.current?.focus();
        }}
      />

      {/* Sheet Container: Mobile bottom sheet (rounded-t-[28px]) / Desktop popover under trigger */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Account at Profile"
        style={
          popoverPos && typeof window !== "undefined" && window.innerWidth >= 768
            ? { top: `${popoverPos.top}px`, right: `${popoverPos.right}px` }
            : undefined
        }
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl md:fixed md:bottom-auto md:left-auto md:right-8 md:top-20 md:w-[400px] md:rounded-3xl md:p-6 md:shadow-xl"
      >
        {/* Header row: 52px chip (#DBEAFE / UserCheck #1D4ED8), Title (21px bold), Subtitle (14px slate-500), 48px close button */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-[#DBEAFE]">
              <UserCheck className="h-7 w-7 text-[#1D4ED8]" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-[21px] font-bold text-slate-900 leading-tight">
                Account
              </h2>
              <p className="text-[14px] text-slate-500 mt-0.5 leading-snug">
                Pamahalaan ang iyong profile at settings
              </p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => {
              onClose();
              triggerRef?.current?.focus();
            }}
            aria-label="Isara ang Account"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Profile Card: bg #EFF6FF, border-2 #BFDBFE, rounded-[20px], p-4, 64px rounded-[18px] avatar */}
        <div className="mt-4 rounded-[20px] border-2 border-[#BFDBFE] bg-[#EFF6FF] p-4 flex items-center gap-3.5 shadow-xs">
          <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[18px] bg-[#1D4ED8] text-white text-[24px] font-bold tracking-wide">
            {profileInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[21px] font-bold text-slate-900 leading-tight truncate">
              {profileName}
            </p>
            <p className="text-[15px] font-medium text-slate-600 mt-0.5 truncate">
              {profileRoleSubtitle}
            </p>
          </div>
        </div>

        {/* Menu Rows: min-h-[72px], rounded-[18px], bg slate-50, p-4, 48px rounded-[14px] icon chip, 18px bold title, 14px subtitle, ChevronRight */}
        <div className="mt-4 space-y-2.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  item.onClick();
                }}
                className={`flex min-h-[72px] w-full items-center gap-3.5 rounded-[18px] p-4 text-left transition active:scale-[0.99] cursor-pointer ${
                  item.itemBg ?? "bg-slate-50 hover:bg-slate-100/90"
                }`}
              >
                {/* 48px rounded-[14px] icon chip */}
                <div
                  className={`flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[14px] ${item.iconBg} ${item.iconColor}`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                {/* Title & subtitle */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[18px] font-bold leading-tight ${
                      item.titleColor ?? "text-slate-900"
                    }`}
                  >
                    {item.title}
                  </p>
                  <p
                    className={`text-[14px] mt-0.5 leading-snug ${
                      item.subtitleColor ?? "text-slate-500"
                    }`}
                  >
                    {item.subtitle}
                  </p>
                </div>

                {/* Badge if present */}
                {item.badge !== undefined && (
                  <span
                    className={`flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 text-xs font-bold text-white ${
                      item.badgeBg ?? "bg-blue-600"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                <ChevronRight
                  className={`h-5 w-5 shrink-0 ${
                    item.chevronColor ?? "text-slate-400"
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        {/* Footer: 14px centered with top border */}
        <div className="mt-5 border-t border-slate-200 pt-3.5 text-center text-[14px] font-medium text-slate-400">
          {footerText}
        </div>
      </div>
    </>
  );
};

export default AccountSheet;
