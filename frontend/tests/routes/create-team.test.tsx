import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CreateTeamPage from "../../app/routes/create-team"; // Adjust path as needed

// Mock useNavigate from react-router
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

describe("CreateTeamPage", () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders the creation form correctly", () => {
    render(
      <MemoryRouter>
        <CreateTeamPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Create a New Team/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Team Name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. Los Angeles Lakers/i)).toBeInTheDocument();
  });

  it("disables the submit button when team name is empty", () => {
    render(
      <MemoryRouter>
        <CreateTeamPage />
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole("button", { name: /Create Team/i });
    expect(submitBtn).toBeDisabled();
  });

  it("successfully submits the form and navigates to the new team page", async () => {
    render(
      <MemoryRouter>
        <CreateTeamPage />
      </MemoryRouter>
    );

    const nameInput = screen.getByLabelText(/Team Name/i);
    const descInput = screen.getByLabelText(/Description/i);
    const submitBtn = screen.getByRole("button", { name: /Create Team/i });

    // Fill out the form
    fireEvent.change(nameInput, { target: { value: "Golden State Warriors" } });
    fireEvent.change(descInput, { target: { value: "Bay Area Team" } });
    
    expect(submitBtn).not.toBeDisabled();

    // Submit form
    fireEvent.click(submitBtn);

    // Verify loading state
    expect(screen.getByText(/Creating.../i)).toBeInTheDocument();
    expect(nameInput).toBeDisabled();

    // Fast-forward through the 800ms setTimeout
    act(() => {
      vi.advanceTimersByTime(800);
    });

    // Verify navigation was called with the slugified ID
    expect(mockNavigate).toHaveBeenCalledWith("/team/golden-state-warriors");
  });

  it("navigates back when Cancel is clicked", () => {
    render(
      <MemoryRouter>
        <CreateTeamPage />
      </MemoryRouter>
    );

    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});