import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi } from "vitest";
import FeedPage from "../../app/routes/feed";
import * as reactRouter from "react-router";

// Mock the react-router module to provide data for the component
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useLoaderData: vi.fn(),
    useNavigate: vi.fn(),
    useRevalidator: vi.fn(() => ({ revalidate: vi.fn() })),
  };
});

function sidebarGamblingLink() {
  const gambling = screen.getByRole("link", { name: /^Gambling$/i });
  expect(gambling).toHaveClass("feedSidebarBtn");
  expect(gambling).toHaveAttribute("href", "/gambler");
  return gambling;
}

describe("FeedPage Smoke Test", () => {
  it("renders the feed page without crashing", () => {
    vi.mocked(reactRouter.useLoaderData).mockReturnValue({
      isAdmin: false,
      isCoach: false,
      userId: "test-user",
      backendBaseUrl: "http://localhost:3001",
      feedForYou: [],
      coachPlayers: [],
      adminCoaches: [],
      adminTeamPlayers: [],
    });

    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /^Profile$/i })).toBeInTheDocument();
    sidebarGamblingLink();
  });

  it("non-coach has no top tabs; Gambling is in the sidebar", () => {
    vi.mocked(reactRouter.useLoaderData).mockReturnValue({
      isAdmin: false,
      isCoach: false,
      userId: "test-user",
      backendBaseUrl: "http://localhost:3001",
      feedForYou: [],
      coachPlayers: [],
      adminCoaches: [],
      adminTeamPlayers: [],
    });

    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /^Feed$/i })).not.toBeInTheDocument();
    sidebarGamblingLink();
  });

  it("coach sees Team and News tabs; Gambling stays in the sidebar", () => {
    vi.mocked(reactRouter.useLoaderData).mockReturnValue({
      isAdmin: false,
      isCoach: true,
      userId: "coach-id",
      backendBaseUrl: "http://localhost:3001",
      feedForYou: [],
      coachPlayers: [],
      adminCoaches: [],
      adminTeamPlayers: [],
    });

    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /^Team$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^News$/i })).toBeInTheDocument();
    sidebarGamblingLink();
  });
});
