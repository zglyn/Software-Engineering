import { render, screen, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, it, expect } from "vitest";
import ComparePage from "../../app/routes/compare";

const mockPlayers = [
  {
    player_id: 1,
    name: "LeBron James",
    position: "Forward",
    stats: { total_points: 30, p3_1: 2, p3_0: 5 }
  },
  {
    player_id: 2,
    name: "Stephen Curry",
    position: "Guard",
    stats: { total_points: 35, p3_1: 7, p3_0: 10 }
  }
];

const mockTeams = [
  {
    id: "t1",
    name: "Lakers",
    stats: { PTS: 115.5, W_PCT: 0.6, AST: 25 }
  },
  {
    id: "t2",
    name: "Warriors",
    stats: { PTS: 118.2, W_PCT: 0.55, AST: 30 }
  }
];

describe("ComparePage Component", () => {
  const renderCompare = (loaderData = { players: mockPlayers, teams: mockTeams, defaultTeamId: null }) => {
    // We use path: "/" to ensure an absolute match for initialEntries
    const routes = [
      {
        path: "/",
        element: <ComparePage />,
        loader: () => loaderData,
      },
    ];

    const router = createMemoryRouter(routes, {
      initialEntries: ["/"],
      initialIndex: 0,
    });

    return render(<RouterProvider router={router} />);
  };

  it("renders with initial player mode and search inputs", async () => {
    renderCompare();
    
    // Using findBy instead of getBy helps wait for the Data Router to resolve the loader
    expect(await screen.findByText(/Player 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Player 2/i)).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText(/Search player.../i)).toHaveLength(2);
  });

  it("switches between Player and Team modes", async () => {
    renderCompare();
    
    const teamTab = await screen.findByRole("button", { name: /Teams/i });
    fireEvent.click(teamTab);

    expect(screen.getByText(/Team 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Team 2/i)).toBeInTheDocument();
  });

  it("performs a player comparison when two players are selected", async () => {
    renderCompare();

    const inputs = await screen.findAllByPlaceholderText(/Search player.../i);

    // Select Player 1 (LeBron)
    fireEvent.focus(inputs[0]);
    fireEvent.change(inputs[0], { target: { value: "LeBron" } });
    fireEvent.mouseDown(screen.getByText("LeBron James"));

    // Select Player 2 (Curry)
    fireEvent.focus(inputs[1]);
    fireEvent.change(inputs[1], { target: { value: "Stephen" } });
    fireEvent.mouseDown(screen.getByText("Stephen Curry"));

    expect(screen.getByText("Scoring")).toBeInTheDocument();
    
    // Verify specific values exist in the table
    expect(screen.getByText("2")).toBeInTheDocument();   // LeBron 3PM
    expect(screen.getByText("17")).toBeInTheDocument();  // Curry 3PA
    
    // Use getAllByText for '7' since it appears for BOTH LeBron (3PA) and Curry (3PM)
    const sevens = screen.getAllByText("7");
    expect(sevens.length).toBeGreaterThanOrEqual(2);

    // Verify calculated percentages based on (makes / (makes + misses))
    // LeBron: 2 / (2+5) = 28.6%
    // Curry: 7 / (7+10) = 41.2%
    expect(screen.getByText("28.6%")).toBeInTheDocument();
    expect(screen.getByText("41.2%")).toBeInTheDocument();
  });

  it("performs a team comparison when two teams are selected", async () => {
    renderCompare();
    
    const teamTab = await screen.findByRole("button", { name: /Teams/i });
    fireEvent.click(teamTab);

    const selects = screen.getAllByRole("combobox");
    
    fireEvent.change(selects[0], { target: { value: "t1" } }); 
    fireEvent.change(selects[1], { target: { value: "t2" } }); 

    expect(screen.getByText("Team Stats")).toBeInTheDocument();
    // 0.6 -> 60.0%
    expect(screen.getByText("60.0%")).toBeInTheDocument();
  });
});