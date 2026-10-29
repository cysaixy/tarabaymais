import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { KonsultasyonView } from "../components/konsultasyon/KonsultasyonView";
import type { ExpertCase } from "../services/case.service";

const mockExpertCases: ExpertCase[] = [
  {
    id: "case-c1",
    observationId: "obs-1",
    status: "RESOLVED",
    recommendation: "agoiii kaasi ka mut",
    createdAt: "2026-10-21T08:00:00Z",
    resolvedAt: "2026-10-21T09:30:00Z",
    observation: {
      title: "Natutuyo o brown na dulo",
      description:
        "sobra sobrang pag katuyot\n\n[Tantiya na Naapektuhan: 100% ng Sakahan]",
      severity: "CRITICAL",
      cropCycle: {
        farm: {
          name: "Sakahan ni Juan",
          barangay: "Leonarda",
          municipality: "Alcala",
        },
      },
      farmer: {
        firstName: "Juan",
        lastName: "Dela Cruz",
        phone: "09171234567",
      },
      aiDiagnosis: {
        recommendedAction:
          "Batay sa yugto ng paglago ng mais, regular na inspeksyunin ang usbong at panatilihin ang sapat na moisture sa lupa.",
      },
    },
  },
  {
    id: "case-c2",
    observationId: "obs-2",
    status: "RESOLVED",
    recommendation: "Mag-spray ng organic pesticide tuwing umaga.",
    createdAt: "2026-10-22T08:00:00Z",
    resolvedAt: "2026-10-22T10:00:00Z",
    observation: {
      title: "[Hinihinging Tulong sa LGU Technician] Pag-atake ng uod",
      description: "Maraming uod sa maisan",
      severity: "HIGH",
      cropCycle: {
        farm: {
          name: "Sakahan ni Maria",
          barangay: "Centro Norte (Pob.)",
          municipality: "Alcala",
        },
      },
      farmer: {
        firstName: "Maria",
        lastName: "Santos",
        phone: "09289876543",
      },
      aiDiagnosis: {
        recommendedAction: "Gumamit ng neem oil spray.",
      },
    },
  },
  {
    id: "case-c3",
    observationId: "obs-3",
    status: "SUBMITTED",
    recommendation: null,
    createdAt: "2026-10-23T08:00:00Z",
    observation: {
      title: "Dilaw na dahon",
      description:
        "Naninilaw ang mga dahon sa ibabang bahagi\n\nMagsasaka: Pedro Penduko (09225550123)",
      severity: "MEDIUM",
      cropCycle: {
        farm: {
          name: "Sakahan ni Pedro",
          barangay: "Baybayog",
          municipality: "Alcala",
        },
      },
      farmer: {
        firstName: "Pedro",
        lastName: "Penduko",
        phone: "", // No phone test case
      },
      aiDiagnosis: {
        recommendedAction: "Maglagay ng urea fertilizer.",
      },
    },
  },
];

describe("KonsultasyonView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page header and status chips with accurate counts", () => {
    render(
      <KonsultasyonView expertCases={mockExpertCases} onSendReply={vi.fn()} />
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Mga Konsultasyon" })
    ).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    // Bago 1, Sinagot 2, Lahat 3
    expect(tabs[0]).toHaveTextContent("Bago1");
    expect(tabs[1]).toHaveTextContent("Sinagot2");
    expect(tabs[2]).toHaveTextContent("Lahat3");
  });

  it("renders the selected thread with farmer details, formatted phone, and status", () => {
    render(
      <KonsultasyonView expertCases={mockExpertCases} onSendReply={vi.fn()} />
    );

    // First thread is selected by default (Juan Dela Cruz)
    const threadList = screen.getByRole("list", {
      name: "Mga thread ng konsultasyon",
    });
    expect(within(threadList).getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(within(threadList).getByText("0917 123 4567")).toBeInTheDocument();
    expect(
      within(threadList).getByText("Natutuyo o brown na dulo")
    ).toBeInTheDocument();
    expect(within(threadList).getByText("Leonarda")).toBeInTheDocument();
  });

  it("renders compact contact bar with Tumawag, Mag-SMS, and Kopyahin buttons", async () => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(
      <KonsultasyonView expertCases={mockExpertCases} onSendReply={vi.fn()} />
    );

    const contactBar = screen.getByLabelText(
      "Impormasyon sa Pakikipag-ugnayan sa Magsasaka"
    );
    expect(within(contactBar).getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(within(contactBar).getByText("0917 123 4567")).toBeInTheDocument();

    // Call and SMS links
    const callLink = within(contactBar).getByRole("link", {
      name: "Tumawag kay Juan Dela Cruz",
    });
    expect(callLink).toHaveAttribute("href", "tel:+639171234567");

    const smsLink = within(contactBar).getByRole("link", {
      name: "Mag-SMS kay Juan Dela Cruz",
    });
    expect(smsLink).toHaveAttribute("href", "sms:+639171234567");

    // Copy button
    const copyBtn = within(contactBar).getByRole("button", {
      name: /Kopyahin ang numero/i,
    });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "0917 123 4567"
    );
    expect(screen.getByText("Nakopya")).toBeInTheDocument();
  });

  it("parses bracket tags in farmer messages and renders the red badge", () => {
    render(
      <KonsultasyonView expertCases={mockExpertCases} onSendReply={vi.fn()} />
    );

    // Farmer text had tag "[Tantiya na Naapektuhan: 100% ng Sakahan]" stripped
    expect(screen.getByText("sobra sobrang pag katuyot")).toBeInTheDocument();
    expect(
      screen.getByText("Tantiya: 100% ng sakahan ang naapektuhan")
    ).toBeInTheDocument();

    // Officer reply
    expect(screen.getByText("agoiii kaasi ka mut")).toBeInTheDocument();
  });

  it("handles Maisy suggestion and populates the reply box on Gamitin click", () => {
    render(
      <KonsultasyonView expertCases={mockExpertCases} onSendReply={vi.fn()} />
    );

    expect(screen.getByText("Mungkahi ni Maisy")).toBeInTheDocument();
    const gamitinBtn = screen.getByRole("button", { name: "Gamitin" });
    fireEvent.click(gamitinBtn);

    const replyInput = screen.getByLabelText("Isulat ang sagot");
    expect(replyInput).toHaveValue(
      "Batay sa yugto ng paglago ng mais, regular na inspeksyunin ang usbong at panatilihin ang sapat na moisture sa lupa."
    );
  });

  it("sends reply when Ipadala button is clicked", async () => {
    const onSend = vi.fn();
    render(
      <KonsultasyonView
        expertCases={mockExpertCases}
        onSendReply={onSend}
      />
    );

    const replyInput = screen.getByLabelText("Isulat ang sagot");
    fireEvent.change(replyInput, { target: { value: "I-check natin bukas." } });

    const sendBtn = screen.getByRole("button", { name: /Ipadala/i });
    expect(sendBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(sendBtn);
    });

    expect(onSend).toHaveBeenCalledWith("case-c1", "I-check natin bukas.");
  });

  it("disables contact buttons when phone is missing", () => {
    render(
      <KonsultasyonView expertCases={mockExpertCases} onSendReply={vi.fn()} />
    );

    // Switch to thread 3 (Pedro Penduko has no phone)
    const threadList = screen.getByRole("list", {
      name: "Mga thread ng konsultasyon",
    });
    const pedroThread = within(threadList).getByText("Pedro Penduko");
    fireEvent.click(pedroThread);

    const contactBar = screen.getByLabelText(
      "Impormasyon sa Pakikipag-ugnayan sa Magsasaka"
    );
    expect(within(contactBar).getByText("Walang numero")).toBeInTheDocument();

    const tumawagBtn = within(contactBar).getByRole("button", {
      name: "Tumawag",
    });
    expect(tumawagBtn).toBeDisabled();

    const smsBtn = within(contactBar).getByRole("button", {
      name: "Mag-SMS",
    });
    expect(smsBtn).toBeDisabled();

    const copyBtn = within(contactBar).getByRole("button", {
      name: /Kopyahin/i,
    });
    expect(copyBtn).toBeDisabled();
  });

  it("handles status chip filtering correctly", () => {
    render(
      <KonsultasyonView expertCases={mockExpertCases} onSendReply={vi.fn()} />
    );

    // Click Bago tab (only case-c3 is Bago)
    const bagoTab = screen.getByRole("tab", { name: /Bago/i });
    fireEvent.click(bagoTab);

    expect(screen.getAllByText("Pedro Penduko").length).toBeGreaterThan(0);
    expect(screen.queryByText("Juan Dela Cruz")).not.toBeInTheDocument();
  });

  it("shows loading skeletons when isLoading is true", () => {
    render(
      <KonsultasyonView
        expertCases={[]}
        isLoading={true}
        onSendReply={vi.fn()}
      />
    );

    expect(
      screen.getByLabelText("Naglo-load ang napiling konsultasyon")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Naglo-load ang usapan")).toBeInTheDocument();
  });
});
