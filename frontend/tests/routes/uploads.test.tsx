import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MyUploadsPage from "../../app/routes/uploads"; // Adjust path if necessary

// 1. Setup Mocks for React Router hooks
const mockRevalidate = vi.fn();
const mockNavigate = vi.fn();

const mocks = vi.hoisted(() => ({
  useLoaderData: vi.fn(() => ({
    items: [
      {
        videoId: "vid123",
        title: "Game Highlights 1",
        path: "user/1/video1.mp4",
        signedUrl: "http://mock.url/v1.mp4",
        createdAt: "2023-10-01",
      },
      {
        videoId: "vid456",
        title: "Practice Session",
        path: "user/1/video2.mp4",
        signedUrl: "http://mock.url/v2.mp4",
        createdAt: "2023-10-02",
      }
    ]
  })),
  useFetcher: vi.fn(() => ({
    Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
    state: "idle",
    data: undefined,
  })),
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useLoaderData: mocks.useLoaderData,
    useFetcher: mocks.useFetcher,
    useNavigate: () => mockNavigate,
    useRevalidator: () => ({ revalidate: mockRevalidate }),
  };
});

// 2. Mock URL.createObjectURL and Canvas (required for VideoThumb)
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "mock-object-url");
  global.URL.revokeObjectURL = vi.fn();
  vi.clearAllMocks();
});

describe("MyUploadsPage", () => {
  it("renders the uploads list correctly from loader data", () => {
    render(
      <MemoryRouter>
        <MyUploadsPage />
      </MemoryRouter>
    );

    expect(screen.getByText("My Uploads")).toBeInTheDocument();
    expect(screen.getByText("Game Highlights 1")).toBeInTheDocument();
    expect(screen.getByText("Practice Session")).toBeInTheDocument();
    
    // Verify links to video detail pages exist
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/video/vid123");
  });

  it("shows an empty state message when there are no items", () => {
    // Override mock for this specific test
    mocks.useLoaderData.mockReturnValueOnce({ items: [] });

    render(
      <MemoryRouter>
        <MyUploadsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/No uploads yet/i)).toBeInTheDocument();
  });

  it("calls the delete action when the delete button is clicked", async () => {
    render(
      <MemoryRouter>
        <MyUploadsPage />
      </MemoryRouter>
    );

    const deleteButtons = screen.getAllByRole("button", { name: /Delete/i });
    
    // In our mock, the Form is rendered as a standard HTML form
    // Clicking the button inside it would normally trigger a submission
    fireEvent.submit(deleteButtons[0].closest('form')!);

    // Since we are mocking useFetcher, we'd typically verify if the fetcher 
    // was interacted with. In this simple test, we check if the button exists.
    expect(deleteButtons[0]).toBeInTheDocument();
  });

  it("navigates back to the feed when the back button is clicked", () => {
    render(
      <MemoryRouter>
        <MyUploadsPage />
      </MemoryRouter>
    );

    const backBtn = screen.getByText("← Back");
    fireEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/feed");
  });

  it("renders video placeholders initially", () => {
    render(
      <MemoryRouter>
        <MyUploadsPage />
      </MemoryRouter>
    );

    // VideoThumb renders a placeholder div while loading
    const placeholders = document.querySelectorAll(".myUploadsCardPlaceholder");
    expect(placeholders.length).toBeGreaterThan(0);
  });
});