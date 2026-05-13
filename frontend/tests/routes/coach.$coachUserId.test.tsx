import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, it, expect, vi, afterEach } from "vitest";
import CoachProfilePage from "../../app/routes/coach.$coachUserId";

describe("CoachProfilePage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders coach name and role from loader", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, notes: [] }),
      })
    );

    const mockLoaderData = {
      coachUserId: "coach-uuid",
      coachName: "Pat Smith",
      coachRole: "Head Coach",
      userId: "admin-1",
      userName: "Admin",
      backendBaseUrl: "http://localhost:8080",
      canViewNotes: true,
      canWriteNotes: true,
    };

    const router = createMemoryRouter(
      [
        {
          path: "/coach/:coachUserId",
          element: <CoachProfilePage />,
          loader: () => mockLoaderData,
        },
      ],
      { initialEntries: ["/coach/coach-uuid"] }
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Pat Smith/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/Head Coach/i)).toBeInTheDocument();
  });
});
