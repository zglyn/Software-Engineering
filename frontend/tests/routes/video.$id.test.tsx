import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, it, expect, vi } from "vitest";
import VideoPage from "../../app/routes/video.$id";

vi.mock("../../app/context/UploadContext", () => ({
  useUpload: () => ({
    isUploading: false,
    uploadProgress: {}, 
    videos: {
      "vid-1": {
        id: "vid-1", 
        status: "pending", 
        analysisStatus: "pending",
        name: "Game Tape",
        title: "Game Tape"
      }
    }
  }),
  UploadProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

describe("VideoPage", () => {
  it("renders pending analysis state correctly", async () => {
    
    const videoData = { 
      id: "vid-1", 
      status: "pending", 
      analysisStatus: "pending",
      name: "Game Tape",
      title: "Game Tape"
    };

    const mockLoaderData = {
      ...videoData,
      model: videoData,
      video: videoData,
    };

    const router = createMemoryRouter(
      [
        {
          path: "/video/:id",
          element: <VideoPage />,
          loader: () => mockLoaderData,
        },
      ],
      { initialEntries: ["/video/vid-1"] }
    );

    render(<RouterProvider router={router} />);

    // Fix: Look for the actual text the component renders for a pending video
    await waitFor(() => {
      expect(screen.getByText(/Stats not yet generated/i)).toBeInTheDocument();
    });
  });
});