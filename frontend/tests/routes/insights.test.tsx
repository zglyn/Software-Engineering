import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
// 1. Import the hook directly from react-router
import { useLoaderData } from "react-router"; 
import { describe, it, expect, vi, beforeEach } from "vitest";
import InsightsPage from "../../app/routes/insights";

// 2. Mock the module
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useLoaderData: vi.fn(), // Initialize as a vi.fn()
  };
});

global.fetch = vi.fn();

describe("InsightsPage Component", () => {
  const mockTeams = [
    {
      id: "1",
      name: "Tandon Torches",
      stats: {
        W: 10,
        L: 5,
        PTS: 110.5,
        PLUS_MINUS: 5.2,
        FG_PCT: 0.485,
        FG3_PCT: 0.36,
        FT_PCT: 0.82,
        AST: 25,
        REB: 42,
        TOV: 12,
        PF: 18,
        STL: 7,
        BLK: 4,
      },
    },
    {
      id: "2",
      name: "Brooklyn Nets",
      stats: {
        W: 5,
        L: 10,
        PTS: 102.1,
        PLUS_MINUS: -3.1,
        FG_PCT: 0.44,
        FG3_PCT: 0.32,
        FT_PCT: 0.75,
        AST: 20,
        REB: 38,
        TOV: 15,
        PF: 22,
        STL: 5,
        BLK: 3,
      },
    },
  ];

  const mockLoaderData = {
    teams: mockTeams,
    defaultTeamId: "1",
    backendBaseUrl: "http://localhost:3001",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // 3. Access the mock directly via the imported name
    vi.mocked(useLoaderData).mockReturnValue(mockLoaderData);
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        games: [
          { gameDate: "2023-10-01", matchup: "vs NET", wl: "W", scored: 115, allowed: 102 },
        ],
      }),
    });
  });

  // ... rest of the tests remain the same
  it("renders the initial team overview and stats correctly", async () => {
    render(
      <MemoryRouter>
        <InsightsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Select Team to Analyze/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Tandon Torches")).toBeInTheDocument();
    expect(screen.getByText("10-5")).toBeInTheDocument();
  });
});