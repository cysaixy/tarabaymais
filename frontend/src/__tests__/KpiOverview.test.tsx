import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  KpiOverview,
  KpiOverviewSkeleton,
  formatDelta,
  formatHours,
  getPeriodLabel,
} from "../components/dashboard/KpiOverview";

describe("KpiOverview formatters", () => {
  it("formats hours with .0 if integer and preserves float if already decimal", () => {
    expect(formatHours(68)).toBe("68.0");
    expect(formatHours(68.0)).toBe("68.0");
    expect(formatHours(70.45)).toBe("70.45");
  });

  it("formats positive, negative, and zero deltas properly", () => {
    const positive = formatDelta({ value: 27.4, percent: 100 });
    expect(positive?.arrow).toBe("↗");
    expect(positive?.text).toBe("+27.4 (100%)");

    const negative = formatDelta({ value: -5.2, percent: 15 });
    expect(negative?.arrow).toBe("↘");
    expect(negative?.text).toBe("-5.2 (15%)");

    const zero = formatDelta({ value: 0, percent: 0 }, "sa 30 araw");
    expect(zero?.arrow).toBe("—");
    expect(zero?.text).toBe("+0 (0%)");
    expect(zero?.full).toBe("— +0 (0%) sa 30 araw");
  });

  it("returns correct period labels in Tagalog", () => {
    expect(getPeriodLabel("7d")).toBe("sa 7 araw");
    expect(getPeriodLabel("30d")).toBe("sa 30 araw");
    expect(getPeriodLabel("season")).toBe("sa season");
  });
});

describe("KpiOverview component", () => {
  const defaultProps = {
    activeHectares: 15,
    farmCount: 2,
    farmsDelta: { value: 0, percent: 0 },
    avgResponseHours: 68.0,
    responseDelta: { value: 27.4, percent: 100 },
    damageReports: 5,
    openConsultations: 0,
    period: "30d" as const,
  };

  it("renders with section aria-label 'Pangunahing bilang'", () => {
    render(<KpiOverview {...defaultProps} />);
    const section = screen.getByRole("region", { name: "Pangunahing bilang" });
    expect(section).toBeInTheDocument();
  });

  it("renders the hero values with aria-label for accessibility", () => {
    render(<KpiOverview {...defaultProps} />);
    expect(
      screen.getByLabelText("15 ektarya ng aktibong taniman")
    ).toBeInTheDocument();
    expect(screen.getByText("2 rehistradong sakahan")).toBeInTheDocument();
    expect(screen.getByText(/Aktibong Taniman ng Mais/i)).toBeInTheDocument();
  });

  it("renders response time card with clock and delta", () => {
    render(<KpiOverview {...defaultProps} />);
    expect(
      screen.getByLabelText("68.0 oras na karaniwang tugon")
    ).toBeInTheDocument();
    expect(screen.getByText("Oras ng Tugon")).toBeInTheDocument();
    expect(screen.getByText("oras")).toBeInTheDocument();
    expect(screen.getByText(/27.4/)).toBeInTheDocument();
  });

  it("renders damage reports with vertical bars", () => {
    render(<KpiOverview {...defaultProps} />);
    expect(screen.getByLabelText("5 ulat ng pinsala")).toBeInTheDocument();
  });

  it("renders calm green consultation pill when 0", () => {
    render(<KpiOverview {...defaultProps} openConsultations={0} />);
    const consultNumber = screen.getByLabelText("0 bukas na konsultasyon");
    expect(consultNumber).toBeInTheDocument();
    expect(consultNumber.className).toContain("text-[#0a6b45]");
  });

  it("switches to amber style when consultations > 0", () => {
    render(<KpiOverview {...defaultProps} openConsultations={3} />);
    const consultNumber = screen.getByLabelText("3 bukas na konsultasyon");
    expect(consultNumber).toBeInTheDocument();
    expect(consultNumber.className).toContain("text-[#7a3a04]");
  });

  it("displays skeleton placeholder when isLoading is true or directly via KpiOverviewSkeleton", () => {
    render(<KpiOverview {...defaultProps} isLoading={true} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    const { container } = render(<KpiOverviewSkeleton />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("displays inline error alert when error is provided", () => {
    render(
      <KpiOverview
        {...defaultProps}
        error="Hindi ma-load ang impormasyon ng pananim."
      />
    );
    expect(
      screen.getByText("Hindi ma-load ang impormasyon ng pananim.")
    ).toBeInTheDocument();
  });

  it("calls onPeriodChange when a period button is clicked", async () => {
    const handlePeriodChange = vi.fn();
    render(
      <KpiOverview
        {...defaultProps}
        onPeriodChange={handlePeriodChange}
        showPeriodToggle={true}
      />
    );
    const sevenDaysBtn = screen.getByRole("button", { name: "7 araw" });
    await userEvent.click(sevenDaysBtn);
    expect(handlePeriodChange).toHaveBeenCalledWith("7d");
  });
});
