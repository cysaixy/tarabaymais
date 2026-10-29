import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PinsalaView } from "../components/pinsala/PinsalaView";
import type { DisasterReport } from "../services/case.service";

const mockDisasterReports: DisasterReport[] = [
  {
    id: "case-1",
    farmId: "farm-1",
    disasterType: "PEST_OUTBREAK",
    damagePercentage: 40,
    status: "SUBMITTED",
    notes: "ang bilis ng pag dami ng mga pest (Magsasaka: Cyrus)",
    createdAt: "2026-10-20T10:00:00Z",
    farm: {
      name: "Sakahan ni Cyrus",
      barangay: "Centro Norte (Pob.)",
      municipality: "Alcala",
    },
  },
  {
    id: "case-2",
    farmId: "farm-2",
    disasterType: "TYPHOON",
    damagePercentage: 100,
    status: "SUBMITTED",
    notes: "[Naapektuhan: 2.5 ha] pinsala sa hangin (Magsasaka: Cyrus)",
    createdAt: "2026-10-21T10:00:00Z",
    farm: {
      name: "Sakahan ni Cyrus",
      barangay: "Centro Norte (Pob.)",
      municipality: "Alcala",
    },
  },
  {
    id: "case-3",
    farmId: "farm-3",
    disasterType: "FLOOD",
    damagePercentage: 100,
    status: "SUBMITTED",
    notes: "[Naapektuhan: 2.5 ha] lubog sa tubig (Magsasaka: CITY)",
    createdAt: "2026-10-22T10:00:00Z",
    farm: {
      name: "Sakahan ni CITY",
      barangay: "Leonarda",
      municipality: "Alcala",
    },
  },
  {
    id: "case-4",
    farmId: "farm-4",
    disasterType: "PEST_OUTBREAK",
    damagePercentage: 50,
    status: "SUBMITTED",
    notes: "[Naapektuhan: 1.3 ha] peste (Magsasaka: CITY)",
    createdAt: "2026-10-23T10:00:00Z",
    farm: {
      name: "Sakahan ni CITY",
      barangay: "Leonarda",
      municipality: "Alcala",
    },
  },
  {
    id: "case-5",
    farmId: "farm-5",
    disasterType: "DROUGHT",
    damagePercentage: 50,
    status: "RESOLVED",
    notes: "[Naapektuhan: 1.3 ha] tuyo ang lupa (Magsasaka: Cyrus)",
    createdAt: "2026-10-24T10:00:00Z",
    farm: {
      name: "Sakahan ni Cyrus",
      barangay: "Centro Norte (Pob.)",
      municipality: "Alcala",
    },
  },
];

describe("PinsalaView Component", () => {
  it("renders page header and all status filter chips with accurate counts", () => {
    render(
      <PinsalaView
        disasterReports={mockDisasterReports}
        onVerifyCase={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Mga Kaso ng Pinsala" })).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveTextContent("Lahat5");
    expect(tabs[1]).toHaveTextContent("Bago4");
    expect(tabs[2]).toHaveTextContent("Sinusuri0");
    expect(tabs[3]).toHaveTextContent("Na-verify0");
    expect(tabs[4]).toHaveTextContent("Aprubado1");
  });

  it("renders the selected case card with Filipino labels and mapped enums", () => {
    render(
      <PinsalaView
        disasterReports={mockDisasterReports}
        onVerifyCase={vi.fn()}
      />
    );

    // Selected case is Blg. 1 (case-1): PEST_OUTBREAK -> Pagdami ng Peste
    expect(screen.getByText(/NAPILING KASO · BLG\. 1/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Pagdami ng Peste" })).toBeInTheDocument();
    expect(screen.getByText("ang bilis ng pag dami ng mga pest")).toBeInTheDocument();
    expect(screen.getByText("Tala sa Sakahan")).toBeInTheDocument();

    // Process steps inside the selected card
    const stepList = screen.getByRole("list", { name: "Proseso ng Kaso" });
    expect(within(stepList).getByText("Naisumite")).toBeInTheDocument();
    expect(within(stepList).getByText("Sinusuri")).toBeInTheDocument();
    expect(within(stepList).getByText("Na-verify sa bukid")).toBeInTheDocument();
    expect(within(stepList).getByText("Aprubado")).toBeInTheDocument();
  });

  it("calculates total hectares in dark summary panel and groups by damage type", () => {
    render(
      <PinsalaView
        disasterReports={mockDisasterReports}
        onVerifyCase={vi.fn()}
      />
    );

    const summarySection = screen.getByRole("region", { name: "APEKTADONG TANIMAN" });
    expect(within(summarySection).getByText("8.6")).toBeInTheDocument();
    expect(within(summarySection).getByText("sa 5 kaso")).toBeInTheDocument();

    const barangaySection = screen.getByRole("region", { name: "Kaso ayon sa Barangay" });
    expect(within(barangaySection).getByText("Centro Norte (Pob.)")).toBeInTheDocument();
    expect(within(barangaySection).getByText("3")).toBeInTheDocument();
    expect(within(barangaySection).getByText("Leonarda")).toBeInTheDocument();
    expect(within(barangaySection).getByText("2")).toBeInTheDocument();
  });

  it("renders compact rows for other cases and switches selected case on click", () => {
    render(
      <PinsalaView
        disasterReports={mockDisasterReports}
        onVerifyCase={vi.fn()}
      />
    );

    // Other cases: Blg. 2, 3, 4, 5 exist in the DOM
    expect(screen.getAllByText("Blg. 2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blg. 3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blg. 4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blg. 5").length).toBeGreaterThan(0);

    // Click on Blg. 2 (TYPHOON -> Bagyo)
    const row2Btn = screen.getByRole("button", { name: /Piliin ang Kaso Blg\. 2/i });
    fireEvent.click(row2Btn);

    // Now Selected Case should be Blg. 2 Bagyo
    expect(screen.getByText(/NAPILING KASO · BLG\. 2/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Bagyo" })).toBeInTheDocument();

    // Blg. 1 should now be in the other cases list
    expect(screen.getByRole("button", { name: /Piliin ang Kaso Blg\. 1/i })).toBeInTheDocument();
  });

  it("handles filtering by status chip", () => {
    render(
      <PinsalaView
        disasterReports={mockDisasterReports}
        onVerifyCase={vi.fn()}
      />
    );

    // Click Aprubado chip
    const aprubadoTab = screen.getByRole("tab", { name: /Aprubado/i });
    fireEvent.click(aprubadoTab);

    // Only Case 5 is Aprubado (Tagtuyot, 1.3 ha)
    expect(screen.getByText(/NAPILING KASO · BLG\. 5/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Tagtuyot" })).toBeInTheDocument();

    // Exactly one case: other-cases list is hidden!
    expect(screen.queryByRole("button", { name: /Piliin ang Kaso/i })).not.toBeInTheDocument();

    // Summary panel shows 1.3 ha in 1 case
    const summarySection = screen.getByRole("region", { name: "APEKTADONG TANIMAN" });
    expect(within(summarySection).getByText("1.3")).toBeInTheDocument();
    expect(within(summarySection).getByText("sa 1 kaso")).toBeInTheDocument();
  });

  it("shows empty state when no cases match the active filter", () => {
    render(
      <PinsalaView
        disasterReports={mockDisasterReports}
        onVerifyCase={vi.fn()}
      />
    );

    // Click Sinusuri (count 0)
    const sinusuriTab = screen.getByRole("tab", { name: /Sinusuri/i });
    fireEvent.click(sinusuriTab);

    expect(screen.getByText("Walang kaso sa napiling katayuan.")).toBeInTheDocument();
    const summarySection = screen.getByRole("region", { name: "APEKTADONG TANIMAN" });
    expect(within(summarySection).getByText("0")).toBeInTheDocument();
    expect(within(summarySection).getByText("sa 0 kaso")).toBeInTheDocument();
  });

  it("disables primary button when case is already Aprubado or Na-verify", () => {
    const onVerify = vi.fn();
    render(
      <PinsalaView
        disasterReports={[mockDisasterReports[4]!]} // Case 5 is Aprubado
        onVerifyCase={onVerify}
      />
    );

    const verifyBtn = screen.getByRole("button", { name: /I-verify sa Bukid/i });
    expect(verifyBtn).toBeDisabled();
    fireEvent.click(verifyBtn);
    expect(onVerify).not.toHaveBeenCalled();
  });

  it("calls onVerifyCase when primary button is clicked on an unverified case", () => {
    const onVerify = vi.fn();
    render(
      <PinsalaView
        disasterReports={mockDisasterReports}
        onVerifyCase={onVerify}
      />
    );

    const verifyBtn = screen.getByRole("button", { name: /I-verify sa Bukid/i });
    expect(verifyBtn).not.toBeDisabled();
    fireEvent.click(verifyBtn);
    expect(onVerify).toHaveBeenCalledWith("case-1");
  });

  it("calls onApproveCase when Aprubahan button is clicked", () => {
    const onApprove = vi.fn();
    render(
      <PinsalaView
        disasterReports={mockDisasterReports}
        onVerifyCase={vi.fn()}
        onApproveCase={onApprove}
      />
    );

    const approveBtn = screen.getByRole("button", { name: /Aprubahan/i });
    expect(approveBtn).not.toBeDisabled();
    fireEvent.click(approveBtn);
    expect(onApprove).toHaveBeenCalledWith("case-1");
  });

  it("does not render Humingi ng Dokumento button", () => {
    render(
      <PinsalaView
        disasterReports={mockDisasterReports}
        onVerifyCase={vi.fn()}
      />
    );

    expect(screen.queryByText(/Humingi ng Dokumento/i)).not.toBeInTheDocument();
  });

  it("renders skeletons when isLoading is true", () => {
    render(
      <PinsalaView
        disasterReports={[]}
        isLoading={true}
        onVerifyCase={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Naglo-load ang napiling kaso")).toBeInTheDocument();
    expect(screen.getByLabelText("Naglo-load ang buod ng apektadong taniman")).toBeInTheDocument();
    expect(screen.getByLabelText("Naglo-load ang datos ng barangay")).toBeInTheDocument();
  });
});
