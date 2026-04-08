import React, { useState, useRef, useEffect } from 'react';
import { Link, redirect, useLoaderData, useFetcher } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { getSession } from '~/services/session.server';
import './ManageCoachesPage.css';

const ROLE_OPTIONS = ['Coach', 'Assistant Coach'] as const;
type CoachRole = typeof ROLE_OPTIONS[number];

interface UserOption {
  id: string;
  name: string;
}

interface Coach {
  role: string;
  name: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user || !(user.groups ?? []).includes('admin')) {
    throw redirect('/feed');
  }

  const base = process.env.BACKEND_URL;

  const [usersRes, coachesRes] = await Promise.allSettled([
    fetch(`${base}/api/users`),
    fetch(`${base}/api/coaches?adminId=${user.id}`),
  ]);

  let users: UserOption[] = [];
  if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
    const data = await usersRes.value.json() as { userId: string; name: string }[];
    users = data
      .filter(u => u.name && u.userId !== user.id)
      .map(u => ({ id: u.userId, name: u.name }));
  }

  let coaches: Coach[] = [];
  if (coachesRes.status === 'fulfilled' && coachesRes.value.ok) {
    const data = await coachesRes.value.json() as Record<string, string>;
    const userMap = new Map(users.map(u => [u.id, u.name]));
    coaches = Object.entries(data).map(([role, userId]) => ({
      role,
      name: userMap.get(userId) ?? userId,
    }));
  }

  return { users, coaches };
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user || !(user.groups ?? []).includes('admin')) {
    throw redirect('/feed');
  }

  const formData = await request.formData();
  const intent = formData.get('intent') as string;
  const base = process.env.BACKEND_URL;

  if (intent === 'remove') {
    const role = formData.get('role') as string;
    await fetch(`${base}/api/coaches?adminId=${user.id}&role=${encodeURIComponent(role)}`, {
      method: 'DELETE',
    });
  } else {
    const role = formData.get('role') as string;
    const userId = formData.get('userId') as string;
    await fetch(`${base}/api/coaches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: user.id, role, userId }),
    });
  }

  return null;
}

const ManageCoachesPage: React.FC = () => {
  const { users, coaches: loadedCoaches } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const [coaches, setCoaches] = useState<Coach[]>(loadedCoaches);
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CoachRole | ''>('');
  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCoaches(loadedCoaches);
  }, [loadedCoaches]);

  const takenRoles = new Set(coaches.map(c => c.role));
  const availableRoles = ROLE_OPTIONS.filter(r => !takenRoles.has(r));

  const filtered = query.trim()
    ? users.filter(u => u.name.toLowerCase().includes(query.toLowerCase()))
    : users;

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedUser(null);
    setDropdownOpen(true);
  };

  const handleSelect = (u: UserOption) => {
    setSelectedUser(u);
    setQuery(u.name);
    setDropdownOpen(false);
  };

  const handleAddCoach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedRole) return;
    const formData = new FormData();
    formData.append('intent', 'add');
    formData.append('role', selectedRole);
    formData.append('userId', selectedUser.id);
    fetcher.submit(formData, { method: 'POST' });
    setQuery('');
    setSelectedUser(null);
    setSelectedRole('');
  };

  useEffect(() => {
    if (selectedRole && takenRoles.has(selectedRole)) {
      setSelectedRole('');
    }
  }, [coaches]);

  const handleRemoveCoach = (role: string) => {
    const formData = new FormData();
    formData.append('intent', 'remove');
    formData.append('role', role);
    fetcher.submit(formData, { method: 'POST' });
  };

  return (
    <div className="manageCoachesWrapper">
      <header className="manageCoachesHeader">
        <Link to="/feed" className="manageCoachesBackBtn">← Feed</Link>
      </header>

      <div className="manageCoachesContainer">
        <div className="manageCoachesCard">
          <h2 className="manageCoachesCardTitle">Add New Staff</h2>
          <form className="manageCoachesForm" onSubmit={handleAddCoach}>
            <div className="manageCoachesInputGroup" ref={comboboxRef} style={{ position: 'relative' }}>
              <label className="manageCoachesLabel">Name</label>
              <input
                type="text"
                className="manageCoachesInput"
                placeholder="Search by name..."
                value={query}
                onChange={handleQueryChange}
                onFocus={() => setDropdownOpen(true)}
                autoComplete="off"
              />
              {dropdownOpen && filtered.length > 0 && (
                <ul className="manageCoachesDropdown">
                  {filtered.map(u => (
                    <li
                      key={u.id}
                      className="manageCoachesDropdownItem"
                      onMouseDown={() => handleSelect(u)}
                    >
                      {u.name}
                    </li>
                  ))}
                </ul>
              )}
              {dropdownOpen && query.trim() && filtered.length === 0 && (
                <div className="manageCoachesDropdownEmpty">No users match</div>
              )}
            </div>

            <div className="manageCoachesInputGroup">
              <label className="manageCoachesLabel">Role</label>
              <select
                className="manageCoachesInput"
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value as CoachRole | '')}
              >
                <option value="">Select role...</option>
                {availableRoles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="manageCoachesBtnPrimary"
              disabled={!selectedUser || !selectedRole}
            >
              Add
            </button>
          </form>
        </div>

        <div className="manageCoachesCard">
          <h2 className="manageCoachesCardTitle">Current Coaching Staff</h2>
          {coaches.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No coaches found.</p>
          ) : (
            <table className="manageCoachesTable">
              <thead>
                <tr>
                  <th className="manageCoachesTableTh">Name</th>
                  <th className="manageCoachesTableTh">Title</th>
                  <th className="manageCoachesTableTh"></th>
                </tr>
              </thead>
              <tbody>
                {coaches.map(coach => (
                  <tr key={coach.role} className="manageCoachesTableRow">
                    <td className="manageCoachesTableTd">{coach.name}</td>
                    <td className="manageCoachesTableTd">{coach.role}</td>
                    <td className="manageCoachesTableTd manageCoachesTableTdAction">
                      <button
                        className="manageCoachesBtnDanger"
                        onClick={() => handleRemoveCoach(coach.role)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageCoachesPage;
