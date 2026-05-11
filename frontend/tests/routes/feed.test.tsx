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

describe("FeedPage Smoke Test", () => {
  it("renders the feed page without crashing", () => {
    // Provide a safe return value for useLoaderData
    vi.mocked(reactRouter.useLoaderData).mockReturnValue({
      isAdmin: false,
      isCoach: false,
      userId: "test-user",
      backendBaseUrl: "http://localhost:3001",
      feedForYou: [], // This ensures items.length is 0, not undefined
      coachPlayers: [],
    });

    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>
    );

    // Verify the search bar exists (proving the page rendered)
    expect(screen.getByPlaceholderText(/Search players, teams.../i)).toBeInTheDocument();
  });
});