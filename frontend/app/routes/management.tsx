import React from "react";
import { Link } from "react-router";
import "./ManagementPage.css";

type Role = "GM" | "RECRUITER" | "COACH" | "PLAYER";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  team?: string;
};

export default function ManagementPage() {
  const [users, setUsers] = React.useState<UserRow[]>([
    { id: "u1", name: "Ibrahim A", email: "ibrahima@torches.com", role: "PLAYER", team: "Tandon Torches" },
    { id: "u2", name: "Pranav S", email: "pranavs@torches.com", role: "COACH", team: "Tandon Torches" },
    { id: "u3", name: "Liyan C", email: "liyanc@nets.com", role: "RECRUITER", team: "Brooklyn Nets" },
    { id: "u4", name: "Dharun R", email: "dharunr@nets.com", role: "GM", team: "Brooklyn Nets" },
  ]);

  const [selectedUserId, setSelectedUserId] = React.useState("u1");
  const [selectedRole, setSelectedRole] = React.useState<Role>("PLAYER");

  function assignRole(userId: string, newRole: Role) {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
  }

  function deleteRole(userId: string) {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: "PLAYER" } : u))
    );
  }

  return (
    <div className="managementPage">
      <div className="managementPageHeader">
        <Link to="/" className="managementPageBack">
          ← Back
        </Link>
      </div>

      <div className="managementPageContent">
        <p className="managementPageMessage">Management portal</p>
        <h1 className="managementPageTitle">Role management</h1>
        <p className="managementPageSubtitle">
          Assign and remove roles for team members.
        </p>

        <section className="managementPageSection">
          <h2 className="managementPageSectionTitle">Quick Actions</h2>

          <div className="managementQuickGrid">
            <select
              className="managementInput"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>

            <select
              className="managementInput"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as Role)}
            >
              <option value="PLAYER">PLAYER</option>
              <option value="COACH">COACH</option>
              <option value="RECRUITER">RECRUITER</option>
              <option value="GM">GM</option>
            </select>

            <button
              className="managementPrimaryBtn"
              onClick={() => assignRole(selectedUserId, selectedRole)}
            >
              Assign
            </button>

            <button
              className="managementSecondaryBtn"
              onClick={() => deleteRole(selectedUserId)}
            >
              Delete Role
            </button>
          </div>
        </section>

        <section className="managementPageSection">
          <h2 className="managementPageSectionTitle">Users</h2>

          <div className="managementTableWrap">
            <table className="managementTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Team</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.team ?? "-"}</td>
                    <td>
                      <span className="managementRoleChip">{u.role}</span>
                    </td>
                    <td>
                      <div className="managementActions">
                        <button
                          className="managementSecondaryBtn"
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setSelectedRole(u.role);
                          }}
                        >
                          Select
                        </button>

                        <button
                          className="managementSecondaryBtn"
                          disabled={u.role === "PLAYER"}
                          onClick={() => deleteRole(u.id)}
                        >
                          Delete Role
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
