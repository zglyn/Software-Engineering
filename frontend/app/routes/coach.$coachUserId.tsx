import React, { useEffect, useState } from 'react';
import { Link, redirect, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { getSession } from '~/services/session.server';

import './ComparePage.css';
import './ManagePlayersPage.css';
import './PlayerStatsPage.css';

type NoteRow = {
  note_id?: string;
  notes_id?: string;
  sender_id: string;
  sender_name?: string;
  recipient_id: string;
  note_content: string;
  date_created: string;
};

const NOTE_PREVIEW_CHARS = 220;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user) throw redirect('/login');
  const userName =
    (typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : null) ??
    (typeof user?.email === 'string' && user.email.trim() ? user.email.trim() : null);
  const userId =
    (typeof user?.id === 'string' && user.id.trim() ? user.id.trim() : null) ??
    (typeof user?.email === 'string' && user.email.trim() ? user.email.trim() : null);
  const groups = user.groups ?? [];
  const isCoach = groups.includes('coaches');
  const isAdmin = groups.includes('admin');
  const backendBaseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const raw = String(params.coachUserId ?? '').trim();
  if (!raw || !userId) throw redirect('/feed');

  let resolvedCoachUserId = '';
  if (raw === 'me') {
    if (!isCoach) throw redirect('/feed');
    resolvedCoachUserId = userId;
  } else if (raw.startsWith('for-role-')) {
    if (!isAdmin) throw redirect('/feed');
    const payload = raw.slice('for-role-'.length);
    let role: string;
    try {
      const pad = payload.length % 4 === 0 ? '' : '='.repeat(4 - (payload.length % 4));
      const b64 = payload.replace(/-/g, '+').replace(/_/g, '/') + pad;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      role = new TextDecoder().decode(bytes);
    } catch {
      throw redirect('/feed');
    }
    const tr = await fetch(`${backendBaseUrl}/api/coaches?adminId=${encodeURIComponent(userId)}`);
    if (!tr.ok) throw redirect('/feed');
    const staff = (await tr.json()) as Record<string, string>;
    const uid = staff[role];
    if (uid == null || String(uid).trim() === '') throw redirect('/feed');
    resolvedCoachUserId = String(uid).trim();
  } else {
    resolvedCoachUserId = raw;
    const selfCoach = isCoach && userId === resolvedCoachUserId;
    if (!isAdmin && !selfCoach) throw redirect('/feed');
  }

  const coachUserId = resolvedCoachUserId;

  const isSelfCoach = isCoach && userId === coachUserId;
  let coachName = coachUserId;
  let coachRole = 'Coach';
  const pr = await fetch(
    `${backendBaseUrl}/api/coaches/profile-for-viewer?viewerId=${encodeURIComponent(userId)}&coachUserId=${encodeURIComponent(coachUserId)}`
  );
  if (!pr.ok) throw redirect('/feed');
  const profile = (await pr.json().catch(() => ({}))) as { name?: string; role?: string };
  coachName = typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : coachUserId;
  coachRole = typeof profile.role === 'string' && profile.role.trim() ? profile.role.trim() : 'Coach';

  return {
    coachUserId,
    coachName,
    coachRole,
    userId,
    userName: userName ?? '',
    backendBaseUrl,
    isAdmin,
    isCoach,
    isSelfCoach,
    canViewNotes: true,
    canWriteNotes: isAdmin,
  };
}

export default function CoachProfilePage() {
  const {
    coachUserId,
    coachName,
    coachRole,
    userId,
    userName,
    backendBaseUrl,
    canViewNotes,
    canWriteNotes,
  } = useLoaderData<typeof loader>();

  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Record<string, boolean>>({});

  const formatNoteDate = (iso: string) => {
    const t = Date.parse(String(iso || ''));
    if (!Number.isFinite(t)) return String(iso || '').slice(0, 10);
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(t));
  };

  useEffect(() => {
    if (!canViewNotes || !coachUserId || !userId) return;
    let cancelled = false;
    (async () => {
      setLoadingNotes(true);
      try {
        const r = await fetch(
          `${backendBaseUrl}/api/notes/coach-inbox?coachUserId=${encodeURIComponent(coachUserId)}&viewerId=${encodeURIComponent(userId)}`
        );
        const data = (await r.json().catch(() => ({}))) as { ok?: boolean; notes?: NoteRow[] };
        if (!cancelled) setNotes(Array.isArray(data.notes) ? data.notes : []);
      } finally {
        if (!cancelled) setLoadingNotes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canViewNotes, coachUserId, userId, backendBaseUrl]);

  const postNote = async () => {
    if (!canWriteNotes || !noteDraft.trim() || !userId || !coachUserId) return;
    setSendingNote(true);
    try {
      await fetch(`${backendBaseUrl}/api/notes/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: userId,
          sender_name: userName || userId,
          recipient_id: coachUserId,
          note_content: noteDraft.trim(),
        }),
      });
      setNoteDraft('');
      const r = await fetch(
        `${backendBaseUrl}/api/notes/coach-inbox?coachUserId=${encodeURIComponent(coachUserId)}&viewerId=${encodeURIComponent(userId)}`
      );
      const data = (await r.json().catch(() => ({}))) as { notes?: NoteRow[] };
      setNotes(Array.isArray(data.notes) ? data.notes : []);
    } finally {
      setSendingNote(false);
    }
  };

  const deleteNote = async (nid: string) => {
    if (!nid || !userId) return;
    setDeletingNoteId(nid);
    try {
      await fetch(`${backendBaseUrl}/api/notes/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: nid, viewer_id: userId }),
      });
      setNotes((prev) => prev.filter((n) => (n.note_id || n.notes_id) !== nid));
    } finally {
      setDeletingNoteId(null);
    }
  };

  return (
    <div className="comparePageWrapper">
      <header className="compareHeader">
        <Link to="/feed" className="compareBackBtn">
          ← Feed
        </Link>
      </header>

      <section className="playerProfileHero">
        <div className="playerProfileHeroGlow" aria-hidden />
        <div className="playerProfileHeroInner playerProfileHeroInner--coachOnly">
          <div className="playerProfileHeroText">
            <h1 className="playerProfileName">{coachName}</h1>
            <p className="playerProfileRole">{coachRole}</p>
          </div>
        </div>
      </section>

      <div className="playerProfileMain">
        {canViewNotes && coachUserId ? (
          <section className="playerProfileSection">
            <h2 className="playerProfileSectionTitle">Notes from admin</h2>
            <div className="playerProfileNotesPanel">
              {canWriteNotes && (
                <>
                  <textarea
                    className="managePlayersDialogTextarea playerProfileNotesInput"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Write a note for this coach…"
                    rows={4}
                  />
                  <div className="playerProfileNotesActions">
                    <button
                      type="button"
                      className="managePlayersBtnPrimary"
                      disabled={sendingNote || !noteDraft.trim()}
                      onClick={() => void postNote()}
                    >
                      {sendingNote ? 'Saving…' : 'Add note'}
                    </button>
                  </div>
                </>
              )}
              <div className="managePlayersNotesList playerProfileNotesList">
                {loadingNotes ? (
                  <div className="managePlayersNotesEmpty">Loading…</div>
                ) : notes.length === 0 ? (
                  <div className="managePlayersNotesEmpty">No notes yet.</div>
                ) : (
                  notes.map((n) => {
                    const nid = n.note_id || n.notes_id || '';
                    const key = nid || `${n.sender_id}-${n.date_created}`;
                    const expandKey = nid || key;
                    const full = String(n.note_content ?? '');
                    const isLong = full.length > NOTE_PREVIEW_CHARS;
                    const expanded = Boolean(expandedNoteIds[expandKey]);
                    const preview =
                      full.slice(0, NOTE_PREVIEW_CHARS).replace(/\s+\S*$/, '').trimEnd() ||
                      full.slice(0, NOTE_PREVIEW_CHARS);
                    return (
                      <div key={key} className="managePlayersNoteItem">
                        <div className="managePlayersNoteItemTop">
                          <div className="managePlayersNoteDate">{formatNoteDate(String(n.date_created || ''))}</div>
                          {userId === n.sender_id ? (
                            <button
                              type="button"
                              className="managePlayersNoteDeleteBtn"
                              aria-label="Delete note"
                              disabled={deletingNoteId === nid}
                              onClick={() => void deleteNote(nid)}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                        <div className="playerProfileNoteAuthor">{n.sender_name || n.sender_id}</div>
                        {!isLong ? (
                          <div className="managePlayersNotePreview">{full}</div>
                        ) : expanded ? (
                          <>
                            <div className="managePlayersNotePreview">{full}</div>
                            <button
                              type="button"
                              className="playerProfileNoteExpandToggle"
                              onClick={() =>
                                setExpandedNoteIds((prev) => {
                                  const next = { ...prev };
                                  delete next[expandKey];
                                  return next;
                                })
                              }
                            >
                              Show less
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="playerProfileNotePreviewExpand"
                            onClick={() => setExpandedNoteIds((prev) => ({ ...prev, [expandKey]: true }))}
                          >
                            <span className="managePlayersNotePreview playerProfileNotePreviewInline">{preview}…</span>
                            <span className="playerProfileNoteExpandHint">Show more</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
