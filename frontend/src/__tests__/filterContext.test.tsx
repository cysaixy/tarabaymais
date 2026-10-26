/**
 * Tests for GlobalFilterProvider and useFilter.
 *
 * Covers:
 *  1. useFilter throws the correct error when rendered outside a provider.
 *  2. useFilter returns the context value when rendered inside a provider.
 *  3. A representative officer-route subtree (OfficerDashboardPage) renders
 *     without throwing when the full provider tree is in place.
 *
 * Heavy dependencies (firebase, leaflet, analytics hooks) are mocked so the
 * tests exercise only the context wiring, not the data-fetching layer.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { GlobalFilterProvider } from "../context/filterContext";
import { useFilter } from "../context/useFilter";
import { OfficerDashboardPage } from "../pages/officer/OfficerDashboardPage";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks — must be hoisted before any imports that touch these modules.
// ─────────────────────────────────────────────────────────────────────────────

// Firebase — OfficerDashboardPage → authContext → firebase/app
vi.mock("../firebase", () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn(() => vi.fn()) },
  db: {},
}));

// authContext — provide a minimal auth context so useAuth() doesn't throw
vi.mock("../context/authContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../context/authContext")>();
  return {
    ...actual,
    useAuth: () => ({
      user: null,
      profile: null,
      role: null,
      loading: false,
      logout: vi.fn(),
      refreshProfile: vi.fn(),
    }),
  };
});

// Analytics hooks — return empty/loading states so no network calls are made
vi.mock("../hooks/useOfficerAnalytics", () => ({
  useOverview: () => ({ data: null, loading: true, error: null }),
  useCropStages: () => ({ data: null, loading: true, error: null }),
  useScanTrends: () => ({ data: null, loading: true, error: null }),
  useTopIssues: () => ({ data: null, loading: true, error: null }),
  useDisasters: () => ({ data: null, loading: true, error: null }),
  useFarmsGeo: () => ({ data: null, loading: true, error: null }),
  useQueue: () => ({ data: null, loading: true, error: null }),
  useBarangays: () => ({ data: null, loading: true, error: null }),
}));

// Leaflet / react-leaflet — jsdom has no canvas/SVG support
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  CircleMarker: () => null,
  Popup: () => null,
  useMap: () => ({}),
}));

// Notification tracking — pure localStorage helpers, safe to stub
vi.mock("../lib/notificationReadTracking", () => ({
  getUnreadNotificationsCount: vi.fn(() => 0),
  loadReadNotificationIds: vi.fn(() => new Set<string>()),
  saveReadIds: vi.fn(),
  clearReadNotifications: vi.fn(),
  markNotificationsAsRead: vi.fn(),
  deriveNotifications: vi.fn(() => []),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders a component that calls useFilter() and returns its value.
 * Used to assert both the happy path and the error path.
 */
function FilterConsumer({ onValue }: { onValue: (v: ReturnType<typeof useFilter>) => void }) {
  onValue(useFilter());
  return <div data-testid="consumer">ok</div>;
}

/** Silences React's console.error during error-boundary / throw tests. */
function suppressConsoleError() {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  return () => spy.mockRestore();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Error path — no provider
// ─────────────────────────────────────────────────────────────────────────────

describe("useFilter — outside provider", () => {
  it("throws with a message referencing GlobalFilterProvider", () => {
    const restore = suppressConsoleError();

    expect(() =>
      render(
        <MemoryRouter>
          <FilterConsumer onValue={() => {}} />
        </MemoryRouter>,
      ),
    ).toThrow(/GlobalFilterProvider/);

    restore();
  });

  it("error message includes the fix location (AppRouter)", () => {
    const restore = suppressConsoleError();

    let caught: unknown;
    try {
      render(
        <MemoryRouter>
          <FilterConsumer onValue={() => {}} />
        </MemoryRouter>,
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/AppRouter/);

    restore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Happy path — inside provider
// ─────────────────────────────────────────────────────────────────────────────

describe("useFilter — inside GlobalFilterProvider", () => {
  it("returns a non-null context value", () => {
    let received: ReturnType<typeof useFilter> | null = null;

    render(
      <MemoryRouter>
        <GlobalFilterProvider>
          <FilterConsumer onValue={(v) => { received = v; }} />
        </GlobalFilterProvider>
      </MemoryRouter>,
    );

    expect(received).not.toBeNull();
    expect(screen.getByTestId("consumer")).toBeInTheDocument();
  });

  it("exposes the expected filter keys", () => {
    let received: ReturnType<typeof useFilter> | null = null;

    render(
      <MemoryRouter>
        <GlobalFilterProvider>
          <FilterConsumer onValue={(v) => { received = v; }} />
        </GlobalFilterProvider>
      </MemoryRouter>,
    );

    const ctx = received!;
    expect(typeof ctx.barangay).toBe("string");
    expect(["7d", "30d", "season", "custom"]).toContain(ctx.range);
    expect(typeof ctx.setBarangay).toBe("function");
    expect(typeof ctx.setRange).toBe("function");
    expect(typeof ctx.setCustomRange).toBe("function");
    // apiFrom / apiTo are derived dates — should be ISO-8601 date strings
    expect(ctx.apiFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ctx.apiTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("apiFrom/apiTo reflect current time, not a stale build-time date", () => {
    let received: ReturnType<typeof useFilter> | null = null;

    render(
      <MemoryRouter>
        <GlobalFilterProvider>
          <FilterConsumer onValue={(v) => { received = v; }} />
        </GlobalFilterProvider>
      </MemoryRouter>,
    );

    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    // Allow ±1 day tolerance for timezone differences between UTC and local time
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    expect([yesterday, today, tomorrow]).toContain(received!.apiTo!);
    expect(received!.apiFrom! <= (received!.apiTo!)).toBe(true);
    expect(received!.apiFrom! >= thirtyDaysAgo).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Officer route subtree — renders without crashing
// ─────────────────────────────────────────────────────────────────────────────

describe("OfficerDashboardPage — provider tree", () => {
  beforeAll(() => {
    // ResizeObserver is used by recharts; jsdom doesn't include it
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("renders inside GlobalFilterProvider without throwing", async () => {
    const restore = suppressConsoleError();

    expect(() =>
      render(
        <MemoryRouter initialEntries={["/officer/dashboard"]}>
          <GlobalFilterProvider>
            <OfficerDashboardPage />
          </GlobalFilterProvider>
        </MemoryRouter>,
      ),
    ).not.toThrow();

    restore();
  }, 15_000);

  it("renders the sidebar navigation items", async () => {
    render(
      <MemoryRouter initialEntries={["/officer/dashboard"]}>
        <GlobalFilterProvider>
          <OfficerDashboardPage />
        </GlobalFilterProvider>
      </MemoryRouter>,
    );

    // The sidebar has Tagalog tab labels; at least one should be visible.
    // "Buod" and "Pinsala" appear in both the desktop sidebar and the mobile
    // bottom nav, so we use getAllByText and check there is at least one.
    expect(screen.getAllByText("Buod").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pinsala").length).toBeGreaterThanOrEqual(1);
  }, 15_000);
});
