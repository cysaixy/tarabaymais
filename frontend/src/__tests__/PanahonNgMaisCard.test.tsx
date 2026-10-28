import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PanahonNgMaisCard,
  PanahonNgMaisSkeleton,
  type StageData,
} from "../components/dashboard/PanahonNgMaisCard";

describe("PanahonNgMaisCard", () => {
  const mockStages: StageData[] = [
    { key: "pagtatanim", ha: 5 },
    { key: "paglago", ha: 0 },
    { key: "pagbubunga", ha: 10 },
    { key: "pag-ani", ha: 0 },
  ];

  it("renders the header with total hectares", () => {
    render(<PanahonNgMaisCard stages={mockStages} />);
    expect(screen.getByText("Panahon ng Mais")).toBeInTheDocument();
    expect(screen.getByText("15 ha")).toBeInTheDocument();
    expect(screen.getByText(/kabuuan/)).toBeInTheDocument();
  });

  it("renders filled blocks with labels and values", () => {
    render(<PanahonNgMaisCard stages={mockStages} />);
    expect(screen.getByText("1 · PAGTATANIM")).toBeInTheDocument();
    expect(screen.getByLabelText("5 ektarya sa PAGTATANIM")).toBeInTheDocument();

    expect(screen.getByText("3 · PAGBUBUNGA")).toBeInTheDocument();
    const largestBlockValue = screen.getByLabelText("10 ektarya sa PAGBUBUNGA");
    expect(largestBlockValue).toBeInTheDocument();
    // Largest block should use text-[52px]
    expect(largestBlockValue.className).toContain("text-[52px]");
  });

  it("renders empty blocks with '— ha'", () => {
    render(<PanahonNgMaisCard stages={mockStages} />);
    expect(screen.getByText("2 · PAGLAGO")).toBeInTheDocument();
    expect(screen.getByText("4 · PAG-ANI")).toBeInTheDocument();
    const dashes = screen.getAllByText("— ha");
    expect(dashes.length).toBe(2);
  });

  it("shows empty state when totalHa is 0", () => {
    const zeroStages: StageData[] = [
      { key: "pagtatanim", ha: 0 },
      { key: "paglago", ha: 0 },
      { key: "pagbubunga", ha: 0 },
      { key: "pag-ani", ha: 0 },
    ];
    render(<PanahonNgMaisCard stages={zeroStages} />);
    expect(screen.getByText("Wala pang aktibong taniman")).toBeInTheDocument();
  });

  it("renders skeleton placeholder when isLoading is true", () => {
    render(<PanahonNgMaisCard stages={mockStages} isLoading={true} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    const { container } = render(<PanahonNgMaisSkeleton />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("renders inline error message when error is set", () => {
    render(
      <PanahonNgMaisCard
        stages={mockStages}
        error="May error sa pagkarga ng mga yugto."
      />
    );
    expect(
      screen.getByText("May error sa pagkarga ng mga yugto.")
    ).toBeInTheDocument();
  });
});
