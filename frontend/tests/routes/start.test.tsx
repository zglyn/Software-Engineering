import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router";
import { describe, it, expect, vi, beforeEach } from "vitest";
import StartPage from "../../app/routes/start"; // Adjust path to match your structure

// Mock useNavigate from react-router
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

describe("StartPage Component", () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  const renderStartPage = () =>
    render(
      <MemoryRouter>
        <StartPage />
      </MemoryRouter>
    );

  it("renders all mode options correctly", () => {
    renderStartPage();

    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("Players")).toBeInTheDocument();
    expect(screen.getByText("Management")).toBeInTheDocument();
    expect(screen.getByText(/Choose how you want to enter/i)).toBeInTheDocument();
  });

  it("disables the Continue button by default", () => {
    renderStartPage();
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    expect(continueBtn).toBeDisabled();
  });

  it("enables the Continue button when a mode is selected", () => {
    renderStartPage();
    
    const publicCard = screen.getByText("Public").closest("button");
    fireEvent.click(publicCard!);

    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    expect(continueBtn).not.toBeDisabled();
    expect(publicCard).toHaveClass("startPageCardActive");
  });

  it("navigates to /feed when Public is selected and Continue is clicked", () => {
    renderStartPage();
    
    fireEvent.click(screen.getByText("Public"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/feed");
  });

  it("navigates to /players when Players is selected and Continue is clicked", () => {
    renderStartPage();
    
    fireEvent.click(screen.getByText("Players"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/players");
  });

  it("navigates to /management when Management is selected and Continue is clicked", () => {
    renderStartPage();
    
    fireEvent.click(screen.getByText("Management"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/management");
  });
});