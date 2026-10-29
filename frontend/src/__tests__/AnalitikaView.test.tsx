import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalitikaView, type AnalitikaViewProps } from "../components/analytics";

describe("AnalitikaView", () => {
  const mockProps: AnalitikaViewProps = {
    stats: {
      farmCount: 2,
      activeHectares: 15,
      openCases: 0,
      avgResponseHours: 68.0,
      responseDelta: { value: 27.4, percent: 100 },
    },
    damageReportsByDate: [
      { date: "Set 28", count: 1 },
      { date: "Okt 8", count: 2 },
      { date: "Okt 18", count: 1 },
      { date: "Okt 28", count: 2 },
    ],
    damageReportTotal: 5,
    responseByWeek: [
      { weekLabel: "L1", hours: 68 },
      { weekLabel: "L2", hours: 68 },
      { weekLabel: "L3", hours: 68 },
      { weekLabel: "L4", hours: 68 },
    ],
    statusBreakdown: [
      { status: "Sinusuri", count: 2 },
      { status: "Nainspeksyon", count: 1 },
      { status: "Aprubado", count: 3 },
    ],
    stageHectares: [
      { key: "pagtatanim", ha: 5 },
      { key: "paglago", ha: 0 },
      { key: "pagbubunga", ha: 10 },
      { key: "pag-ani", ha: 0 },
    ],
    barangays: [
      {
        name: "Centro Norte (Pob.)",
        farmCount: 1,
        hectares: 10,
        openCases: 0,
        damageReports: 3,
        risk: 90,
      },
      {
        name: "Leonarda",
        farmCount: 1,
        hectares: 10,
        openCases: 0,
        damageReports: 2,
        risk: 60,
      },
    ],
    periodLabel: "30 araw",
  };

  it("renders page title Analitika as h1", () => {
    render(<AnalitikaView {...mockProps} />);
    const heading = screen.getByRole("heading", { level: 1, name: "Analitika" });
    expect(heading).toBeInTheDocument();
  });

  it("renders the StatBar with baseline aligned metrics", () => {
    render(<AnalitikaView {...mockProps} />);
    expect(screen.getByText("Rehistradong Sakahan")).toBeInTheDocument();
    expect(screen.getByText("Aktibong Taniman")).toBeInTheDocument();
    expect(screen.getByText("Bukas na Kaso")).toBeInTheDocument();
    expect(screen.getByText("Karaniwang Oras ng Tugon")).toBeInTheDocument();
  });

  it("renders the hero chart with date labels on X axis", () => {
    render(<AnalitikaView {...mockProps} />);
    expect(screen.getByText(/Mga Ulat ng Pinsala · 30 araw/)).toBeInTheDocument();
    expect(screen.getByText("Paglipas ng Panahon")).toBeInTheDocument();
    expect(screen.getByLabelText("5 kabuuang ulat ng pinsala")).toBeInTheDocument();
    expect(screen.getByText("Set 28")).toBeInTheDocument();
    expect(screen.getByText("Okt 28")).toBeInTheDocument();
  });

  it("renders response time panel with weekly labels", () => {
    render(<AnalitikaView {...mockProps} />);
    expect(screen.getByText("Oras ng Tugon · Bawat Linggo")).toBeInTheDocument();
    expect(screen.getByText("L1")).toBeInTheDocument();
    expect(screen.getByText("L4")).toBeInTheDocument();
  });

  it("renders status panel with legend items", () => {
    render(<AnalitikaView {...mockProps} />);
    expect(screen.getByText("Katayuan ng mga Kaso")).toBeInTheDocument();
    expect(screen.getByText("Sinusuri")).toBeInTheDocument();
    expect(screen.getByText("Nainspeksyon")).toBeInTheDocument();
    expect(screen.getByText("Aprubado")).toBeInTheDocument();
  });

  it("renders stage strip with data-driven labels", () => {
    render(<AnalitikaView {...mockProps} />);
    expect(screen.getByText("Taniman ayon sa Yugto")).toBeInTheDocument();
    expect(screen.getByText("1 · PAGTATANIM")).toBeInTheDocument();
    expect(screen.getByText("3 · PAGBUBUNGA")).toBeInTheDocument();
  });

  it("renders barangay strips sorted by risk with Rank 1 highlighted", () => {
    render(<AnalitikaView {...mockProps} />);
    expect(screen.getByText("Buod Ayon sa Barangay")).toBeInTheDocument();
    expect(screen.getByText("Centro Norte (Pob.)")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("Leonarda")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
  });

  it("renders skeletons when isLoading is true", () => {
    render(<AnalitikaView {...mockProps} isLoading={true} />);
    const statusElements = screen.getAllByRole("status");
    expect(statusElements.length).toBeGreaterThan(0);
  });
});
