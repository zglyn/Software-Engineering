import React, { useState, useRef, useEffect, useMemo } from 'react';
import '../routes/ManageCoachesPage.css';

type UserOption = { userId: string; name: string };
type OpenSlot = { player_id: string | number; name: string; position?: string };

export type AddPlayersToTeamDialogProps = {
  open: boolean;
  onClose: () => void;
  coachId: string;
  backendBaseUrl: string;
  onSuccess: () => void;
};

export function AddPlayersToTeamDialog({
  open,
  onClose,
  coachId,
  backendBaseUrl,
  onSuccess,
}: AddPlayersToTeamDialogProps) {
  const [eligibleUsers, setEligibleUsers] = useState<UserOption[]>([]);
  const [openSlots, setOpenSlots] = useState<OpenSlot[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedUser(null);
      setDropdownOpen(false);
      setAssignError(undefined);
      setEligibleUsers([]);
      setOpenSlots([]);
      setSubmitting(false);
      setLoadingOptions(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !coachId) return;
    let cancelled = false;
    setLoadingOptions(true);
    (async () => {
      try {
        const r = await fetch(
          `${backendBaseUrl}/api/coach/player-assign/options?coachId=${encodeURIComponent(coachId)}`
        );
        const data = (await r.json().catch(() => ({}))) as {
          eligibleUsers?: UserOption[];
          openSlots?: OpenSlot[];
        };
        if (!cancelled && r.ok) {
          setEligibleUsers(Array.isArray(data.eligibleUsers) ? data.eligibleUsers : []);
          setOpenSlots(Array.isArray(data.openSlots) ? data.openSlots : []);
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, coachId, backendBaseUrl]);

  const matchedSlot = useMemo(() => {
    if (!selectedUser) return null;
    const want = selectedUser.name.trim();
    return openSlots.find((s) => String(s.name ?? '').trim() === want) ?? null;
  }, [selectedUser, openSlots]);

  const filtered = query.trim()
    ? eligibleUsers.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))
    : eligibleUsers;

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

  const positionLine =
    matchedSlot &&
    matchedSlot.position &&
    String(matchedSlot.position).trim() !== ''
      ? String(matchedSlot.position).trim()
      : matchedSlot
        ? '—'
        : 'No exact roster name match';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !matchedSlot) return;
    setSubmitting(true);
    setAssignError(undefined);
    try {
      const r = await fetch(`${backendBaseUrl}/api/coach/player-assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId,
          userId: selectedUser.userId,
          rosterPlayerId: String(matchedSlot.player_id),
        }),
      });
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) {
        setAssignError(data.error || 'Assignment failed');
        return;
      }
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="feedDialogOverlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="feedDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedAddPlayersTitle"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="feedDialogHeader">
          <h2 id="feedAddPlayersTitle" className="feedDialogTitle">
            Add player to team
          </h2>
          <button type="button" className="feedDialogClose" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="feedDialogBody">
          {loadingOptions ? (
            <p className="manageCoachesFormHint">Loading…</p>
          ) : (
            <form className="manageCoachesForm" onSubmit={(e) => void handleSubmit(e)}>
              <div className="manageCoachesInputGroup" ref={comboboxRef} style={{ position: 'relative' }}>
                <label className="manageCoachesLabel">User</label>
                <input
                  type="text"
                  className="manageCoachesInput"
                  placeholder="Search by name…"
                  value={query}
                  onChange={handleQueryChange}
                  onFocus={() => setDropdownOpen(true)}
                  autoComplete="off"
                />
                {dropdownOpen && filtered.length > 0 && (
                  <ul className="manageCoachesDropdown">
                    {filtered.map((u) => (
                      <li
                        key={u.userId}
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

              {selectedUser && (
                <div className="manageCoachesInputGroup">
                  <label className="manageCoachesLabel">Position</label>
                  <p className="manageCoachesReadout">{positionLine}</p>
                </div>
              )}

              {openSlots.length === 0 && (
                <p className="manageCoachesFormHint">No open roster slots on your team.</p>
              )}
              {eligibleUsers.length === 0 && !loadingOptions && (
                <p className="manageCoachesFormHint">
                  No users available (all may already be linked to a player).
                </p>
              )}
              {assignError && (
                <p className="manageCoachesFormHint manageCoachesFormHint--error">{assignError}</p>
              )}

              <button
                type="submit"
                className="manageCoachesBtnPrimary"
                disabled={!selectedUser || !matchedSlot || submitting}
              >
                {submitting ? 'Saving…' : 'Assign'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
