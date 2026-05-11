import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect } from "vitest";
import PlayersPage from "../../app/routes/players"; // Adjust path to match your structure

describe("PlayersPage Component", () => {
  const renderPlayersPage = () =>
    render(
      <MemoryRouter>
        <PlayersPage />
      </MemoryRouter>
    );

  it("renders the main heading and subtitles", () => {
    renderPlayersPage();

    expect(screen.getByText(/Manage your stats and uploads/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Upload content, control privacy, and access your personal workspace/i)
    ).toBeInTheDocument();
  });

  it("contains a back link to the home page", () => {
    renderPlayersPage();

    const backLink = screen.getByRole("link", { name: /← Back/i });
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("renders the navigation cards with correct links", () => {
    renderPlayersPage();

    // Check Stats Page Card
    const statsLink = screen.getByRole("link", { name: /Stats Page/i });
    expect(statsLink).toHaveAttribute("href", "/stats");
    expect(screen.getByText(/Tag players, choose privacy, and publish stat updates/i)).toBeInTheDocument();

    // Check My Uploads Card
    const uploadsLink = screen.getByRole("link", { name: /My Uploads/i });
    expect(uploadsLink).toHaveAttribute("href", "/uploads");
    expect(screen.getByText(/View uploaded clips and track processing status/i)).toBeInTheDocument();
  });

  it("renders the non-link Profile Controls card", () => {
    renderPlayersPage();

    expect(screen.getByText("Profile Controls")).toBeInTheDocument();
    expect(
      screen.getByText(/Manage what content is public, team-only, or GM-only/i)
    ).toBeInTheDocument();
  });
});