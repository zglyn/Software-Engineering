import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../app/routes/root-redirect";
import { getSession } from "~/services/session.server";

// Mock the session server 
vi.mock("~/services/session.server", () => ({
  getSession: vi.fn(),
}));

describe("root-redirect loader", () => {
  const mockRequest = { headers: new Headers() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to easily mock the session user data
  const mockUserSession = (user: any) => {
    vi.mocked(getSession).mockResolvedValue({
      get: () => user,
    } as any);
  };

  it("redirects to /login if the user is not logged in", async () => {
    mockUserSession(null);

    // Loaders that throw redirects are caught in try/catch blocks in tests
    try {
      await loader({ request: mockRequest } as any);
      expect.unreachable("Should have thrown a redirect");
    } catch (response: any) {
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    }
  });

  it("redirects to /feed for admins", async () => {
    mockUserSession({ groups: ["admin"] });

    try {
      await loader({ request: mockRequest } as any);
    } catch (response: any) {
      expect(response.headers.get("Location")).toBe("/feed");
    }
  });

  it("redirects to /feed for coaches", async () => {
    mockUserSession({ groups: ["coaches"] });

    try {
      await loader({ request: mockRequest } as any);
    } catch (response: any) {
      expect(response.headers.get("Location")).toBe("/feed");
    }
  });

  it("redirects to /feed for generic public users", async () => {
    mockUserSession({ groups: ["public"] });

    try {
      await loader({ request: mockRequest } as any);
    } catch (response: any) {
      expect(response.headers.get("Location")).toBe("/feed");
    }
  });

  it("redirects to /select for players or other roles", async () => {
    // If the user has a specific group that isn't admin/coach/public (like "player")
    mockUserSession({ groups: ["player"] });

    try {
      await loader({ request: mockRequest } as any);
    } catch (response: any) {
      expect(response.headers.get("Location")).toBe("/select");
    }
  });
});