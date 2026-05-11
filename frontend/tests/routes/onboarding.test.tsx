import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi, beforeEach } from "vitest";
import OnboardingPage from "../../app/routes/onboarding";
import { useLoaderData, useActionData, useNavigation } from "react-router";

// 1. Mock React Router hooks
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useLoaderData: vi.fn(),
    useActionData: vi.fn(),
    useNavigation: vi.fn(() => ({ state: "idle" })),
    Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  };
});

describe("OnboardingPage Component", () => {
  const mockPlayerLoaderData = {
    groups: ["player"],
    cognitoName: "LeBron James",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigation).mockReturnValue({ state: "idle" } as any);
  });

  it("renders basic info fields and physical stats for players", () => {
    vi.mocked(useLoaderData).mockReturnValue(mockPlayerLoaderData);

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    // Check header
    expect(screen.getByText(/Set up your profile/i)).toBeInTheDocument();

    // 1. Fix for Name field: 
    // Since it starts as read-only, we check for the label text and the displayed value
    expect(screen.getByText(/Full name/i)).toBeInTheDocument();
    expect(screen.getByText("LeBron James")).toBeInTheDocument();

    // 2. Age is a standard input, so getByLabelText works here
    expect(screen.getByLabelText(/Age/i)).toBeInTheDocument();

    // Check physical stats (only for players)
    expect(screen.getByText(/Physical stats/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Height \(cm\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Weight \(kg\)/i)).toBeInTheDocument();
  });

  it("hides physical stats if the user is not a player", () => {
    vi.mocked(useLoaderData).mockReturnValue({
      groups: ["coach"],
      cognitoName: "Coach K",
    });

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Physical Stats/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Height \(cm\)/i)).not.toBeInTheDocument();
  });

  it("allows editing the name field when the pencil icon is clicked", () => {
    vi.mocked(useLoaderData).mockReturnValue(mockPlayerLoaderData);

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    // Initially, the name is a read-only span
    const nameDisplay = screen.getByText("LeBron James");
    expect(nameDisplay.tagName).not.toBe("INPUT");

    // Click edit (pencil button)
    const editBtn = screen.getByLabelText(/Edit name/i);
    fireEvent.click(editBtn);

    // It should now be an input field
    const nameInput = screen.getByLabelText(/Full Name/i);
    expect(nameInput).toHaveValue("LeBron James");
    fireEvent.change(nameInput, { target: { value: "Bronny James" } });
    expect(nameInput).toHaveValue("Bronny James");
  });

  it("displays validation errors from actionData", () => {
    vi.mocked(useLoaderData).mockReturnValue(mockPlayerLoaderData);
    vi.mocked(useActionData).mockReturnValue({
      errors: {
        age: "Age must be between 10 and 100.",
        height: "Height is required for players.",
      },
    });

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Age must be between 10 and 100.")).toBeInTheDocument();
    expect(screen.getByText("Height is required for players.")).toBeInTheDocument();
  });

  it("shows loading state when the form is submitting", () => {
    vi.mocked(useLoaderData).mockReturnValue(mockPlayerLoaderData);
    vi.mocked(useNavigation).mockReturnValue({ state: "submitting" } as any);

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole("button", { name: /saving/i });
    expect(submitBtn).toBeDisabled();
  });
});