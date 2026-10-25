/**
 * OfficerDashboardPage — redesigned Officer Portal dashboard (/officer/dashboard).
 *
 * Layout (desktop 12-col grid):
 *   Row 1: 5 KpiCards
 *   Row 2: Action queue (5 cols) + map (7 cols)
 *   Row 3: Stage donut, scan trends, top issues
 *   Row 4: Disaster loss chart + barangay table
 *
 * Mobile: bottom nav, full-width stacked cards.
 * Left sidebar on desktop (Buod, Pinsala, Konsultasyon, Ulat).
 * Tagalog UI. Global filter context (barangay + date range) synced to URL.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Bell,
  LogOut,
  LayoutDashboard,
  CloudLightning,
  MessageSquare,
  FileDown,
  Download,
  ChevronDown,
  User,
  MapPin,
  Building2,
  RefreshCw,
  X,
} from "lucide-react";
import { useAuth } from "../../context/authContext";
import { useFilter } from "../../context/useFilter";
import {
  useOverview,
  useCropStages,
  useScanTrends,
  useTopIssues,
  useDisasters,
  useFarmsGeo,
  useQueue,
  useBarangays,
} from "../../hooks/useOfficerAnalytics";
import type {
  CaseStatus,
  DisasterReport,
  ExpertCase,
} from "../../services/case.service";
import {
  getCasePipeline,
  resolveExpertCase,
  updateCaseStatus,
} from "../../services/case.service";
import {
  downloadAnalyticsReport,
  type ExportFormat,
  type ExportType,
} from "../../services/analytics.service";
import type { QueueItem } from "../../services/officerAnalytics.service";
import {
  KpiCard,
  ChartCard,
  SeverityBadge,
  StatusPill,
  ActionQueue,
  FarmMap,
  StageDonut,
  ScanTrendsChart,
  TopIssuesChart,
  DisasterLossChart,
  BarangayTable,
  MaisyFloating,
  type FarmFeature,
  type DisasterFeature,
} from "../../components/dashboard";
import { NotificationBell } from "../../components/NotificationBell";
import { LoadingState } from "../../components/LoadingState";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { AccountSheet, type AccountMenuItem } from "../../components/AccountSheet";
import { clearReadNotifications, getUnreadNotificationsCount } from "../../lib/notificationReadTracking";

type TabKey = "BUOD" | "PINSALA" | "KONSULTASYON" | "ULAT";

type DashboardIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const SIDEBAR_ITEMS: { key: TabKey; label: string; icon: DashboardIcon }[] = [
  { key: "BUOD", label: "Buod", icon: LayoutDashboard },
  { key: "PINSALA", label: "Pinsala", icon: CloudLightning },
  { key: "KONSULTASYON", label: "Konsultasyon", icon: MessageSquare },
  { key: "ULAT", label: "Ulat", icon: FileDown },
];

const MOBILE_ITEMS: { key: TabKey; label: string; icon: DashboardIcon }[] = [
  { key: "BUOD", label: "Buod", icon: LayoutDashboard },
  { key: "PINSALA", label: "Pinsala", icon: CloudLightning },
  { key: "KONSULTASYON", label: "Konsulta", icon: MessageSquare },
  { key: "ULAT", label: "Ulat", icon: FileDown },
];

function toCaseStatus(status: string): CaseStatus {
  switch (status.toUpperCase()) {
    case "UNDER_REVIEW":
      return "UNDER_REVIEW";
    case "INSPECTED":
      return "INSPECTED";
    case "RESOLVED":
      return "RESOLVED";
    case "REJECTED":
      return "REJECTED";
    default:
      return "SUBMITTED";
  }
}

function toNotificationExpertCase(item: QueueItem): ExpertCase {
  return {
    id: item.id,
    observationId: item.id,
    status: toCaseStatus(item.status),
    createdAt: item.createdAt,
    observation: {
      title: item.summary,
      description: item.summary,
      severity: item.severity,
      cropCycle: {
        farm: {
          name: item.farmName,
          barangay: item.barangay,
          municipality: "",
        },
      },
    },
  };
}

function toNotificationDisasterReport(item: QueueItem): DisasterReport {
  return {
    id: item.id,
    farmId: "",
    disasterType: item.summary,
    damagePercentage: 0,
    status: toCaseStatus(item.status),
    createdAt: item.createdAt,
    farm: {
      name: item.farmName,
      barangay: item.barangay,
      municipality: "",
    },
  };
}

export const OfficerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user, logout } = useAuth();
  const {
    barangay,
    apiFrom,
    apiTo,
    setBarangay,
    setRange,
    range,
  } = useFilter();

  const userId = profile?.id ?? user?.uid ?? "";

  const officerName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : (user?.displayName ?? "");
  const officerRole =
    profile?.role === "OFFICER" ? "Municipal Officer" : "Agricultural Technician";
  const profileInitials =
    officerName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "OP";

  // ── Tab state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>("BUOD");
  const [pinsalaView, setPinsalaView] = useState<"action" | "history">("action");
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<ExpertCase | null>(null);
  const [selectedDisaster, setSelectedDisaster] = useState<DisasterReport | null>(null);
  const [consultationLoading, setConsultationLoading] = useState(false);
  const [consultationSubmitting, setConsultationSubmitting] = useState(false);
  const [disasterLoading, setDisasterLoading] = useState(false);
  const [disasterSubmitting, setDisasterSubmitting] = useState(false);
  const [recommendation, setRecommendation] = useState("");
  const [exportType, setExportType] = useState<ExportType>("disaster-claims");
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);

  // ── Data ───────────────────────────────────────────────────────────
  const overview = useOverview({
    barangay: barangay || undefined,
    from: apiFrom ?? undefined,
    to: apiTo ?? undefined,
  });
  const cropStages = useCropStages({
    barangay: barangay || undefined,
    from: apiFrom ?? undefined,
    to: apiTo ?? undefined,
  });
  const scanTrends = useScanTrends({
    barangay: barangay || undefined,
    from: apiFrom ?? undefined,
    to: apiTo ?? undefined,
  });
  const topIssues = useTopIssues({
    barangay: barangay || undefined,
    from: apiFrom ?? undefined,
    to: apiTo ?? undefined,
  });
  const disasters = useDisasters({
    barangay: barangay || undefined,
    from: apiFrom ?? undefined,
    to: apiTo ?? undefined,
    groupBy: "barangay",
  });
  const farmsGeo = useFarmsGeo({ barangay: barangay || undefined });
  const queue = useQueue({ barangay: barangay || undefined, limit: 5 });
  const disasterHistory = useQueue({
    barangay: barangay || undefined,
    limit: 100,
    type: "disaster",
    history: true,
  });
  const barangays = useBarangays();
  const queueDataItems = queue.data?.items;
  const queueItems = useMemo(() => queueDataItems ?? [], [queueDataItems]);
  const notificationExpertCases = useMemo(
    () =>
      queueItems
        .filter((item) => item.type === "case")
        .map(toNotificationExpertCase),
    [queueItems],
  );
  const notificationDisasterReports = useMemo(
    () =>
      queueItems
        .filter((item) => item.type === "disaster")
        .map(toNotificationDisasterReport),
    [queueItems],
  );

  const openCases = overview.data?.openCases.value ?? 0;
  const overdueCases = (queue.data?.items ?? []).filter(
    (i) => i.waitingHours > 48,
  ).length;

  // ── Logout ─────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    try {
      if (userId) clearReadNotifications(userId);
      await logout();
      navigate("/login");
    } catch {
      toast.error("Hindi makapag-logout. Subukan muli.");
    } finally {
      setIsAccountOpen(false);
    }
  }, [userId, logout, navigate]);

  const openConsultation = useCallback(async (caseId: string) => {
    setConsultationLoading(true);
    try {
      const pipeline = await getCasePipeline();
      const selected = pipeline.expertCases.find((item) => item.id === caseId);
      if (!selected) {
        toast.error("Hindi makita ang detalye ng kasong ito.");
        return;
      }
      setSelectedConsultation(selected);
      setRecommendation(selected.recommendation ?? "");
    } catch {
      toast.error("Hindi makuha ang detalye ng kaso. Subukan muli.");
    } finally {
      setConsultationLoading(false);
    }
  }, []);

  const submitRecommendation = useCallback(async () => {
    if (!selectedConsultation || !recommendation.trim()) {
      toast.error("Maglagay ng rekomendasyon bago ipadala.");
      return;
    }
    setConsultationSubmitting(true);
    try {
      await resolveExpertCase(selectedConsultation.id, {
        recommendation: recommendation.trim(),
      });
      toast.success("Naipadala ang rekomendasyon sa magsasaka.");
      setSelectedConsultation(null);
      setRecommendation("");
      await queue.refetch();
    } catch {
      toast.error("Hindi naipadala ang rekomendasyon. Subukan muli.");
    } finally {
      setConsultationSubmitting(false);
    }
  }, [selectedConsultation, recommendation, queue]);

  const openDisaster = useCallback(async (reportId: string) => {
    setDisasterLoading(true);
    try {
      const pipeline = await getCasePipeline();
      const selected = pipeline.disasterCases.find((item) => item.id === reportId);
      if (!selected) {
        toast.error("Hindi makita ang detalye ng claim na ito.");
        return;
      }
      setSelectedDisaster(selected);
    } catch {
      toast.error("Hindi makuha ang detalye ng claim. Subukan muli.");
    } finally {
      setDisasterLoading(false);
    }
  }, []);

  const updateDisaster = useCallback(async (status: CaseStatus) => {
    if (!selectedDisaster) return;
    setDisasterSubmitting(true);
    try {
      await updateCaseStatus(selectedDisaster.id, {
        caseType: "DISASTER_REPORT",
        status,
      });
      toast.success("Na-update ang status ng claim.");
      setSelectedDisaster(null);
      await queue.refetch();
      await disasterHistory.refetch();
      await Promise.all([
        overview.refetch(),
        disasters.refetch(),
        farmsGeo.refetch(),
      ]);
    } catch {
      toast.error("Hindi ma-update ang status ng claim. Subukan muli.");
    } finally {
      setDisasterSubmitting(false);
    }
  }, [disasterHistory, disasters, farmsGeo, overview, queue, selectedDisaster]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setExporting(format);
    try {
      const blob = await downloadAnalyticsReport({
        type: exportType,
        format,
        startDate: apiFrom ?? undefined,
        endDate: apiTo ?? undefined,
        barangay: barangay || undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TarabayMais_${exportType === "barangay-summary" ? "Barangay_Summary" : "Disaster_Claims"}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Na-download ang ulat.");
    } catch {
      toast.error("Hindi ma-download ang ulat. Subukan muli.");
    } finally {
      setExporting(null);
    }
  }, [apiFrom, apiTo, barangay, exportType]);

  // ── Account menu ───────────────────────────────────────────────────
  const unreadNotifCount = useMemo(
    () =>
      getUnreadNotificationsCount(
        notificationExpertCases,
        notificationDisasterReports,
        userId,
      ),
    [notificationDisasterReports, notificationExpertCases, userId],
  );

  const accountMenuItems: AccountMenuItem[] = useMemo(
    () => [
      {
        key: "notifications",
        title: "Mga Abiso",
        subtitle:
          unreadNotifCount > 0
            ? `${unreadNotifCount} bagong abiso`
            : "Walang bagong abiso",
        icon: Bell,
        iconBg: "bg-[#DBEAFE]",
        iconColor: "text-[#1D4ED8]",
        badge: unreadNotifCount > 0 ? unreadNotifCount : undefined,
        badgeBg: "bg-[#1D4ED8]",
        onClick: () => {
          setIsAccountOpen(false);
          setIsNotifOpen(true);
        },
      },
      {
        key: "download-reports",
        title: "I-download ang Ulat",
        subtitle: "Excel at CSV ng claims at barangay",
        icon: FileDown,
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-700",
        onClick: () => {
          setIsAccountOpen(false);
          setActiveTab("ULAT");
        },
      },
      {
        key: "logout",
        title: "Mag-logout",
        subtitle: "Kakailanganin mong mag-login muli",
        icon: LogOut,
        iconBg: "bg-rose-100",
        iconColor: "text-rose-700",
        itemBg: "bg-[#FFF1F2] hover:bg-rose-100/70",
        titleColor: "text-[#B91C1C]",
        subtitleColor: "text-[#DC2626]",
        chevronColor: "text-rose-400",
        onClick: handleLogout,
      },
    ],
    [unreadNotifCount, handleLogout],
  );

  // ── Render tab content ─────────────────────────────────────────────
  const renderBuod = () => {
    // Loading state
    const loading =
      overview.loading ||
      cropStages.loading ||
      scanTrends.loading ||
      topIssues.loading ||
      disasters.loading ||
      farmsGeo.loading ||
      queue.loading ||
      barangays.loading;

    if (loading) {
      return <LoadingState label="Kinukuha ang datos ng dashboard..." fullScreen />;
    }

    if (overview.error || queue.error || farmsGeo.error) {
      return (
        <ErrorState
          title="Hindi makuha ang datos"
          message="Subukan muli ang pag-load ng dashboard."
          onRetry={() => {
            overview.refetch();
            queue.refetch();
            farmsGeo.refetch();
          }}
        />
      );
    }

    if (!overview.data || !queue.data || !farmsGeo.data) {
      return <LoadingState label="Inihahanda ang datos..." fullScreen />;
    }

    const o = overview.data;
    const q = queue.data;
    const g = farmsGeo.data;

    const kpis = [
      {
        title: "Rehistradong Sakahan",
        value: o.totalFarms.value,
        unit: "sakahan",
        delta: o.totalFarms.delta,
        sparkline: o.totalFarms.sparkline,
      },
      {
        title: "Aktibong Taniman ng Mais",
        value: o.activeCornHectares.value,
        unit: "ha",
        delta: o.activeCornHectares.delta,
        sparkline: o.activeCornHectares.sparkline,
      },
      {
        title: "Bukas na Kaso",
        value: o.openCases.value,
        delta: o.openCases.delta,
        sparkline: o.openCases.sparkline,
      },
      {
        title: "Ulat ng Pinsala",
        value: o.disasterReportsThisPeriod.value,
        delta: o.disasterReportsThisPeriod.delta,
        sparkline: o.disasterReportsThisPeriod.sparkline,
      },
      {
        title: "Karaniwang Oras ng Tugon",
        value: o.avgResponseTimeHours.value,
        unit: "oras",
        delta: o.avgResponseTimeHours.delta,
      },
    ];

    // Map features: separate farms from disasters
    const farmFeatures = g.features.filter((f) => !("kind" in f.properties));
    const disasterFeatures = g.features.filter(
      (f): f is DisasterFeature => "kind" in f.properties,
    );

    return (
      <div className="space-y-6">
        {/* Row 1: 5 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpis.map((kpi, i) => (
            <KpiCard key={i} {...kpi} />
          ))}
        </div>

        {/* Row 2: Action Queue (5 cols) + Map (7 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <ActionQueue
              items={q.items}
              total={q.total}
              limit={q.limit}
              offset={q.offset}
              onOpenItem={(item) => {
                setActiveTab(item.type === "case" ? "KONSULTASYON" : "PINSALA");
              }}
            />
          </div>
          <div className="lg:col-span-7">
            <FarmMap
              farms={farmFeatures as FarmFeature[]}
              disasters={disasterFeatures as DisasterFeature[]}
              farmsWithoutLocation={g.farmsWithoutLocation}
            />
          </div>
        </div>

        {/* Row 3: 3 charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard title="Distribusyon ng Yugto ng Taniman" subtitle="Ayon sa ARAW (Days After Planting)">
            <StageDonut stages={cropStages.data?.stages ?? {}} />
          </ChartCard>
          <ChartCard title="Trend ng Pagsusuri ng AI" subtitle="Malusog vs May Pinsala (nobong linggo)">
            <ScanTrendsChart data={scanTrends.data ?? []} />
          </ChartCard>
          <ChartCard title="Mga Pinsala o Sakit sa Pananim" subtitle="Top 8 ayon sa bilang ng kaso">
            <TopIssuesChart data={topIssues.data ?? []} />
          </ChartCard>
        </div>

        {/* Row 4: Disaster loss + barangay table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <ChartCard
              title="Pinsala at Tinatayang Lugi"
              subtitle={`Ayon sa ${disasters.data?.groupBy === "barangay" ? "Barangay" : disasters.data?.groupBy === "month" ? "Buwan" : "Uri"}`}
            >
              <DisasterLossChart data={disasters.data?.groups ?? []} />
            </ChartCard>
          </div>
          <div className="lg:col-span-7">
            <BarangayTable data={barangays.data ?? []} />
          </div>
        </div>
      </div>
    );
  };

  const renderPinsala = () => {
    const source = pinsalaView === "history" ? disasterHistory : queue;
    const disasterItems = (source.data?.items ?? []).filter(
      (i) => i.type === "disaster",
    );
    if (source.loading) {
      return <LoadingState label="Kinukuha ang mga claim..." />;
    }
    if (source.error) {
      return (
        <ErrorState title="Hindi makuha ang mga claim" onRetry={() => source.refetch()} />
      );
    }
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-[22px] font-bold text-slate-900">
              {pinsalaView === "history" ? "Kasaysayan ng Pinsala" : "Kailangan ng Aksyon"}
              <span className="rounded-full bg-[#C2410C] px-3 py-0.5 text-sm font-bold text-white">
                {disasterItems.length}
              </span>
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {pinsalaView === "history"
                ? "Mga claim na naisumite, nasuri, naaprubahan, o tinanggihan."
                : "Mga claim na kailangan pang suriin o aksyunan."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPinsalaView("action")}
              className={`min-h-12 rounded-xl px-4 text-sm font-bold ${pinsalaView === "action" ? "bg-blue-700 text-white" : "border-2 border-slate-300 bg-white text-slate-700"}`}
            >
              Kailangan ng Aksyon
            </button>
            <button
              type="button"
              onClick={() => setPinsalaView("history")}
              className={`min-h-12 rounded-xl px-4 text-sm font-bold ${pinsalaView === "history" ? "bg-blue-700 text-white" : "border-2 border-slate-300 bg-white text-slate-700"}`}
            >
              Kasaysayan
            </button>
            <button
              type="button"
              onClick={() => void source.refetch()}
              disabled={source.loading}
              aria-label="I-refresh ang mga claim"
              className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-5 w-5 ${source.loading ? "animate-spin" : ""}`} aria-hidden="true" />
              I-refresh
            </button>
          </div>
        </div>
        {disasterItems.length === 0 ? (
          <EmptyState
            title={pinsalaView === "history" ? "Walang history sa ngayon" : "Walang claim sa ngayon"}
            message="Walang disaster claim na tumutugma sa napiling filter."
          />
        ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {disasterItems.map((item) => (
            <div
              key={item.id}
              className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <StatusPill status={item.status} />
                <MapPin className="h-5 w-5 shrink-0 text-orange-500" aria-hidden="true" />
              </div>
              <p className="text-lg font-bold text-slate-900">{item.summary}</p>
              <p className="mt-0.5 flex items-center gap-1 text-base text-slate-500">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.farmName} &middot; {item.barangay}
              </p>
              <button
                type="button"
                onClick={() => void openDisaster(item.id)}
                disabled={disasterLoading}
                className="mt-auto flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] text-base font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-blue-400 active:scale-95 cursor-pointer disabled:opacity-60"
              >
                {disasterLoading ? "Kinukuha..." : "Suriin / Sagutin"}
              </button>
            </div>
          ))}
        </div>
        )}
      </div>
    );
  };

  const renderKonsultasyon = () => {
    const caseItems = (queue.data?.items ?? []).filter((i) => i.type === "case");
    if (queue.loading) {
      return <LoadingState label="Kinukuha ang mga kaso..." />;
    }
    if (queue.error) {
      return (
        <ErrorState title="Hindi makuha ang mga kaso" onRetry={() => queue.refetch()} />
      );
    }
    if (caseItems.length === 0) {
      return (
        <EmptyState
          title="Walang kaso sa ngayon"
          message="Walang consultation case na tumutugma sa napiling filter."
        />
      );
    }
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-[22px] font-bold text-slate-900">
              Kaso ng Konsultasyon
              <span className="rounded-full bg-[#BE123C] px-3 py-0.5 text-sm font-bold text-white">
                {caseItems.length}
              </span>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => queue.refetch()}
            disabled={queue.loading}
            className="flex min-h-12 items-center gap-2 rounded-[14px] border-2 border-slate-300 bg-white px-3.5 text-[14px] font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-blue-400 active:scale-95 disabled:opacity-60 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`h-5 w-5 ${queue.loading ? "animate-spin" : ""}`} strokeWidth={2} aria-hidden="true" />
            I-refresh
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {caseItems.map((item) => (
            <div
              key={item.id}
              className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <SeverityBadge severity={item.severity} />
                <StatusPill status={item.status} />
              </div>
              <p className="text-lg font-bold text-slate-900">{item.summary}</p>
              <p className="mt-0.5 flex items-center gap-1 text-base text-slate-500">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.farmName} &middot; {item.barangay}
              </p>
              <button
                type="button"
                onClick={() => void openConsultation(item.id)}
                disabled={consultationLoading}
                className="mt-auto flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] text-base font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-blue-400 active:scale-95 cursor-pointer"
              >
                {consultationLoading ? "Kinukuha..." : "Suriin / Sagutin"}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderUlat = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <FileDown className="h-5 w-5 text-slate-500" aria-hidden="true" />
          <h3 className="text-xl font-bold text-slate-900">I-download ang Ulat</h3>
        </div>
        <p className="mb-4 text-base text-slate-500">
          Para sa disaster claims at buod ng barangay
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="export-type" className="mb-1 block text-base font-semibold text-slate-700">
              Uri ng Ulat
            </label>
            <select
              id="export-type"
              value={exportType}
              onChange={(event) => setExportType(event.target.value as ExportType)}
              disabled={exporting !== null}
              className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-base font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="disaster-claims">Disaster Claims</option>
              <option value="barangay-summary">Buod ng Barangay</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleExport("xlsx")}
              disabled={exporting !== null}
              className="flex h-13 flex-1 items-center justify-center gap-2 rounded-xl bg-[#047857] text-base font-bold text-white transition hover:bg-emerald-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              {exporting === "xlsx" ? "Inihahanda..." : "Excel (.xlsx)"}
            </button>
            <button
              type="button"
              onClick={() => void handleExport("csv")}
              disabled={exporting !== null}
              className="flex h-13 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#047857] text-base font-bold text-[#047857] transition hover:bg-emerald-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              {exporting === "csv" ? "Inihahanda..." : "CSV"}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-base font-bold text-slate-900 mb-3">Filter na Ginamit</h4>
          <p className="text-sm text-slate-600">
            Barangay:{" "}
            <span className="font-semibold">{barangay || "Lahat"}</span>
          </p>
          <p className="text-sm text-slate-600">
            Range:{" "}
            <span className="font-semibold">{range.toUpperCase()}</span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BarangayTable data={barangays.data ?? []} />
        </div>
      </div>
    </div>
  );

  const tabContent = activeTab === "BUOD" ? renderBuod() : activeTab === "PINSALA" ? renderPinsala() : activeTab === "KONSULTASYON" ? renderKonsultasyon() : renderUlat();

  // ── Header ─────────────────────────────────────────────────────────
  const header = (
    <header className="sticky top-0 z-30 border-b border-blue-900/20 bg-[#0F2A5C] text-white shadow-md">
      {/* Mobile row */}
      <div className="flex md:hidden items-center justify-between px-3.5 sm:px-4 h-17">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FBBF24]">
          <Building2 className="h-6.5 w-6.5 text-[#0F2A5C]" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0 mx-2.5 text-[14px] leading-tight">
          <span className="font-bold text-white truncate block">{officerName || "Opisyal"}</span>
          <span className="text-slate-300 text-[13px]">{officerRole}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell
            userId={userId}
            expertCases={notificationExpertCases}
            disasterCases={notificationDisasterReports}
            onOpenCase={(_caseId, type) => {
              setIsNotifOpen(false);
              setActiveTab(type === "KONSULTASYON" ? "KONSULTASYON" : "PINSALA");
            }}
            onViewAll={() => setActiveTab("KONSULTASYON")}
            isOpen={isNotifOpen}
            onOpenChange={setIsNotifOpen}
          />
          <button
            type="button"
            onClick={() => setIsAccountOpen((prev) => !prev)}
            aria-label="Account at profile"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white/45 bg-white/14 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-white active:scale-95 cursor-pointer"
          >
            <User className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Desktop row */}
      <div className="hidden md:flex mx-auto max-w-296 items-center justify-between px-12 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-[#FBBF24]">
            <Building2 className="h-7 w-7 text-[#0F2A5C]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold leading-tight text-white whitespace-nowrap">
              Officer Portal &middot; DA Region II
            </h1>
            <p className="text-[15px] text-slate-300 mt-0.5 whitespace-nowrap">
              Cagayan Valley &middot; Mais at Pinsala ng Sakuna
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <NotificationBell
            userId={userId}
            expertCases={notificationExpertCases}
            disasterCases={notificationDisasterReports}
            onOpenCase={(_caseId, type) => {
              setIsNotifOpen(false);
              setActiveTab(type === "KONSULTASYON" ? "KONSULTASYON" : "PINSALA");
            }}
            onViewAll={() => setActiveTab("KONSULTASYON")}
            isOpen={isNotifOpen}
            onOpenChange={setIsNotifOpen}
          />
          <button
            ref={profileTriggerRef}
            type="button"
            onClick={() => setIsAccountOpen((prev) => !prev)}
            aria-label="Account at profile"
            aria-haspopup="dialog"
            aria-expanded={isAccountOpen}
            className="flex min-h-14 items-center gap-3 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-left text-white transition hover:bg-white/15 focus-visible:outline focus-visible:outline-white active:scale-98 cursor-pointer"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FBBF24] text-[16px] font-bold text-[#0F2A5C]">
              {profileInitials}
            </div>
            <div className="min-w-0 pr-1 max-w-45">
              <p className="text-[17px] font-bold leading-tight text-white truncate">{officerName || "Opisyal"}</p>
              <p className="text-[14px] text-slate-300 leading-snug truncate">{officerRole}</p>
            </div>
            <ChevronDown className={`h-5 w-5 text-slate-300 transition-transform duration-200 ${isAccountOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );

  // ── Desktop sidebar ────────────────────────────────────────────────
  const sidebar = (
    <aside className="hidden md:flex md:w-64 flex-col fixed left-0 top-16 bottom-0 z-20">
      <div className="flex h-full flex-col border-r border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FBBF24]">
            <Building2 className="h-5 w-5 text-[#0F2A5C]" aria-hidden="true" />
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                  isActive
                    ? "bg-[#EFF6FF] text-[#1D4ED8] shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                <span className="text-sm font-bold">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl border border-rose-100 bg-[#FFF1F2] text-[#B91C1C] font-bold text-sm transition hover:bg-rose-100/70"
          >
            <LogOut className="h-4 w-4" />
            Mag-logout
          </button>
        </div>
      </div>
    </aside>
  );

  // ── Mobile bottom nav ──────────────────────────────────────────────
  const bottomNav = (
    <nav aria-label="Pangunahing navigasyon" className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-white border-t-2 border-slate-300 md:hidden">
      <div className="grid grid-cols-4 h-full">
        {MOBILE_ITEMS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-full flex-col items-center justify-center gap-1 transition focus-visible:outline focus-visible:outline-blue-400 cursor-pointer ${
                isActive ? "bg-[#EFF6FF] text-[#1D4ED8]" : "text-[#334155] hover:bg-slate-50"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-[22%] right-[22%] h-1 rounded-b-full bg-[#1D4ED8]" />
              )}
              <div className="relative inline-flex items-center justify-center">
                <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
              </div>
              <span className="text-[12px] font-bold leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {header}

      <main className={`mx-auto max-w-296 px-4 py-6 md:px-0 space-y-6 pb-24 ${activeTab === "BUOD" ? "md:ml-64" : ""}`}>
        {sidebar}

        {/* Global filter bar (desktop) */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 px-0 md:px-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filter:</span>
              <select
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Lahat ng Barangay</option>
                {barangays.data?.map((b) => (
                  <option key={b.barangay} value={b.barangay}>
                    {b.barangay}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Petsa:</span>
              <div className="flex gap-1 rounded-xl border border-slate-300 bg-white px-2">
                <button
                  type="button"
                  onClick={() => setRange("7d")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${range === "7d" ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  7 araw
                </button>
                <button
                  type="button"
                  onClick={() => setRange("30d")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${range === "30d" ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  30 araw
                </button>
                <button
                  type="button"
                  onClick={() => setRange("season")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${range === "season" ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Season
                </button>
              </div>
            </div>
          </div>

        {tabContent}
      </main>

      {bottomNav}

      {/* Maisy floating assistant */}
      {activeTab === "BUOD" && (
        <MaisyFloating overdueCases={overdueCases} openCases={openCases} />
      )}

      {/* Account / profile sheet */}
      <AccountSheet
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        triggerRef={profileTriggerRef}
        profileName={officerName || "Opisyal"}
        profileRoleSubtitle={`${officerRole} &middot; DA Region II`}
        profileInitials={profileInitials}
        menuItems={accountMenuItems}
        footerText="TarabayMais v1.0.0 &middot; DA Region II"
      />

      {selectedConsultation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="consultation-detail-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 id="consultation-detail-title" className="text-2xl font-extrabold text-slate-900">
                  Detalye ng Konsultasyon
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Kaso #{selectedConsultation.id.slice(0, 8)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedConsultation(null)}
                aria-label="Isara"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-200 px-4 py-3">
                  <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                    Larawan ng Pananim
                  </p>
                </div>
                {selectedConsultation.observation?.imageUrl ? (
                  <img
                    src={selectedConsultation.observation.imageUrl}
                    alt="Larawan ng pananim na ipinadala ng magsasaka"
                    className="max-h-96 w-full object-contain bg-slate-100"
                  />
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">
                    Walang larawang nakalakip sa ulat na ito.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Problema</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {selectedConsultation.observation?.title ?? "Hindi available"}
                </p>
                <p className="mt-2 text-base leading-relaxed text-slate-700">
                  {selectedConsultation.observation?.description ?? "Walang detalye ng obserbasyon."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-bold text-slate-500">Magsasaka</p>
                  <p className="mt-1 font-bold text-slate-900">
                    {selectedConsultation.observation?.farmer
                      ? `${selectedConsultation.observation.farmer.firstName} ${selectedConsultation.observation.farmer.lastName}`
                      : "Hindi available"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">Sakahan</p>
                  <p className="mt-1 font-bold text-slate-900">
                    {selectedConsultation.observation?.cropCycle?.farm?.name ?? "Hindi available"}
                  </p>
                  <p className="text-sm text-slate-500">
                    {selectedConsultation.observation?.cropCycle?.farm?.barangay ?? ""}
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="officer-recommendation" className="text-base font-bold text-slate-800">
                  Rekomendasyon para sa magsasaka
                </label>
                <textarea
                  id="officer-recommendation"
                  value={recommendation}
                  onChange={(event) => setRecommendation(event.target.value)}
                  rows={5}
                  placeholder="Isulat ang payo o susunod na hakbang..."
                  className="mt-2 w-full rounded-2xl border border-slate-300 p-4 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <button
                type="button"
                onClick={() => void submitRecommendation()}
                disabled={consultationSubmitting}
                className="min-h-13 w-full rounded-xl bg-[#047857] px-4 text-base font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {consultationSubmitting ? "Ipinapadala..." : "Ipadala ang Rekomendasyon"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedDisaster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disaster-detail-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 id="disaster-detail-title" className="text-2xl font-extrabold text-slate-900">
                  Detalye ng Ulat ng Pinsala
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Claim #{selectedDisaster.id.slice(0, 8)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDisaster(null)}
                aria-label="Isara"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-500">Uri ng Kalamidad</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{selectedDisaster.disasterType}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-500">Status</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{selectedDisaster.status}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-500">Tinatayang Pinsala</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {Number(selectedDisaster.damagePercentage).toFixed(0)}%
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-500">Tinatayang Lugi</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    PHP {Number(selectedDisaster.estimatedLoss ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-500">Sakahan</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {selectedDisaster.farm?.name ?? "Hindi available"}
                </p>
                <p className="text-sm text-slate-500">
                  {selectedDisaster.farm
                    ? `${selectedDisaster.farm.barangay}, ${selectedDisaster.farm.municipality}`
                    : ""}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-500">Salaysay ng Magsasaka</p>
                <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-slate-700">
                  {selectedDisaster.notes || "Walang karagdagang detalye."}
                </p>
              </div>

              {!["RESOLVED", "REJECTED"].includes(selectedDisaster.status) && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => void updateDisaster("UNDER_REVIEW")}
                    disabled={disasterSubmitting}
                    className="min-h-12 rounded-xl border-2 border-blue-600 px-3 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                  >
                    Suriin
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateDisaster("RESOLVED")}
                    disabled={disasterSubmitting}
                    className="min-h-12 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    Aprubahan
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateDisaster("REJECTED")}
                    disabled={disasterSubmitting}
                    className="min-h-12 rounded-xl bg-rose-700 px-3 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-60"
                  >
                    Tanggihan
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerDashboardPage;
