import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi, beforeEach } from "vitest";
import StatsPage from "../../app/routes/stats";
import { api } from "../../app/api/mock";

// Mock the API module
vi.mock("../../app/api/mock", () => ({
  api: {
    listPlayers: vi.fn(),
    getAllPlayers: vi.fn(),
    listPosts: vi.fn(),
    createPost: vi.fn(),
  },
}));

describe("StatsPage Component", () => {
  const mockPlayers = [
    { id: "p1", name: "LeBron James", team: "Lakers", position: "F" },
    { id: "p2", name: "Anthony Davis", team: "Lakers", position: "C" },
  ];

  const mockPosts = [
    {
      id: "1",
      title: "Season Opener",
      privacy: "PUBLIC",
      taggedPlayerIds: ["p1"],
      createdAtISO: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (api.listPlayers as any).mockResolvedValue(mockPlayers);
    (api.getAllPlayers as any).mockResolvedValue(mockPlayers);
    (api.listPosts as any).mockResolvedValue(mockPosts);
    (api.createPost as any).mockImplementation((post: any) => 
      Promise.resolve({ ...post, id: "new-id", createdAtISO: new Date().toISOString() })
    );
  });

  it("renders loading state initially then shows posts", async () => {
    render(
      <MemoryRouter>
        <StatsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Season Opener")).toBeInTheDocument();
      // Use getAllByText because LeBron appears in both the tag list and the existing post
      const lebronElements = screen.getAllByText(/LeBron James/i);
      expect(lebronElements.length).toBeGreaterThan(0);
    });
  });

  it("allows creating and publishing a new stat post", async () => {
    render(
      <MemoryRouter>
        <StatsPage />
      </MemoryRouter>
    );

    // Wait for data to load
    await waitFor(() => screen.getAllByText(/LeBron James/i));

    // 1. Fill out title (shortened regex for robustness)
    const titleInput = screen.getByPlaceholderText(/Title \(ex: Game vs Rutgers/i);
    fireEvent.change(titleInput, { target: { value: "New Post Title" } });

    // 2. Target the selection tag specifically
    const tagList = screen.getByText("Anthony Davis").closest('.statsTagList');
    const playerTag = within(tagList as HTMLElement).getByText("LeBron James");
    fireEvent.click(playerTag);
    
    // 3. Verify tag in the "Create Stat Post" section only
    const createSection = screen.getByText("Create Stat Post").closest('section');
    expect(within(createSection as HTMLElement).getByText(/Tagged: LeBron James/i)).toBeInTheDocument();

    // 4. Publish
    const publishBtn = screen.getByRole("button", { name: /Publish/i });
    fireEvent.click(publishBtn);

    // 5. Verify API call
    await waitFor(() => {
      expect(api.createPost).toHaveBeenCalledWith(expect.objectContaining({
        title: "New Post Title",
        taggedPlayerIds: ["p1"],
      }));
    });

    // 6. Verify new post appears in the feed
    expect(screen.getByText("New Post Title")).toBeInTheDocument();
  });

  it("filters players based on search input", async () => {
    render(
      <MemoryRouter>
        <StatsPage />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Search players to tag.../i);
    fireEvent.change(searchInput, { target: { value: "Anthony" } });

    await waitFor(() => {
      expect(api.listPlayers).toHaveBeenCalledWith("Anthony");
    });
  });

  it("navigates back to the players portal", () => {
    render(
      <MemoryRouter>
        <StatsPage />
      </MemoryRouter>
    );
    const backLink = screen.getByRole("link", { name: /← Back/i });
    expect(backLink).toHaveAttribute("href", "/players");
  });
});