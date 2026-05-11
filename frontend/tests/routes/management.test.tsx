import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect } from "vitest";
import ManagementPage from "../../app/routes/management";

describe("ManagementPage Component", () => {
  const renderManagement = () => {
    return render(
      <MemoryRouter>
        <ManagementPage />
      </MemoryRouter>
    );
  };

  it("renders the management portal with initial user data", () => {
    renderManagement();

    expect(screen.getByText(/Management portal/i)).toBeInTheDocument();
    expect(screen.getByText(/Role management/i)).toBeInTheDocument();
    
    // Check for initial users from the state
    expect(screen.getByText("Ibrahim A")).toBeInTheDocument();
    expect(screen.getByText("Dharun R")).toBeInTheDocument();
    expect(screen.getByText("ibrahima@torches.com")).toBeInTheDocument();
  });

  it("allows selecting a user and assigning a new role", () => {
    renderManagement();

    // 1. Select the user dropdown
    const userSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    fireEvent.change(userSelect, { target: { value: "u1" } }); // Ibrahim A

    // 2. Select the role dropdown
    const roleSelect = screen.getAllByRole("combobox")[1] as HTMLSelectElement;
    fireEvent.change(roleSelect, { target: { value: "GM" } });

    // 3. Click Assign
    const assignBtn = screen.getByRole("button", { name: /Assign/i });
    fireEvent.click(assignBtn);

    // 4. Verify the role chip updated in the table for Ibrahim A
    const rows = screen.getAllByRole("row");
    const ibrahimRow = rows.find(row => row.textContent?.includes("Ibrahim A"));
    expect(ibrahimRow).toHaveTextContent("GM");
  });

  it("resets a role to PLAYER when 'Delete Role' is clicked", () => {
    renderManagement();

    // Dharun R (u4) is a GM by default
    const dharunRow = screen.getAllByRole("row").find(row => row.textContent?.includes("Dharun R"));
    expect(dharunRow).toHaveTextContent("GM");

    // Find the Delete Role button within that specific row
    const deleteBtn = screen.getAllByRole("button", { name: /Delete Role/i }).find(btn => {
        // We want the button in the table row, not the quick actions section
        return btn.closest("tr")?.textContent?.includes("Dharun R");
    });

    if (deleteBtn) fireEvent.click(deleteBtn);

    // Should revert to PLAYER
    expect(dharunRow).toHaveTextContent("PLAYER");
  });

  it("disables the Delete Role button for users who are already PLAYERS", () => {
    renderManagement();

    // Ibrahim A (u1) is a PLAYER by default
    const ibrahimDeleteBtn = screen.getAllByRole("button", { name: /Delete Role/i }).find(btn => 
        btn.closest("tr")?.textContent?.includes("Ibrahim A")
    );

    expect(ibrahimDeleteBtn).toBeDisabled();
  });

  it("populates quick actions when 'Select' is clicked in the table", () => {
    renderManagement();

    // Click 'Select' for Liyan C (u3)
    const liyanSelectBtn = screen.getAllByRole("button", { name: /Select/i }).find(btn => 
        btn.closest("tr")?.textContent?.includes("Liyan C")
    );

    if (liyanSelectBtn) fireEvent.click(liyanSelectBtn);

    const userSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    const roleSelect = screen.getAllByRole("combobox")[1] as HTMLSelectElement;

    expect(userSelect.value).toBe("u3");
    expect(roleSelect.value).toBe("RECRUITER");
  });

  it("has a functioning back link to the home page", () => {
    renderManagement();
    const backLink = screen.getByRole("link", { name: /Back/i });
    expect(backLink).toHaveAttribute("href", "/");
  });
});