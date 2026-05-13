import React from 'react';
import { Link, redirect, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { getSession } from '~/services/session.server';
import { PLAYERS_BY_ID } from '~/data/mockStats';
import {
  PlayerProfileView,
  buildViewModelFromApi,
  buildViewModelFromMock,
  type PlayerPageViewModel,
} from '~/components/playerProfile/PlayerProfileView';

import './ComparePage.css';
import './ManagePlayersPage.css';
import './PlayerStatsPage.css';
import './Profile.css';

type ProfileSelf =
  | {
    kind: 'admin';
    title: string;
    teamName: string;
    displayName: string;
    age: number | null;
    sex: string | null;
    joinDate: string | null;
  }
  | {
    kind: 'coach';
    displayName: string;
    role: string;
    teamName: string;
    coachUserId: string;
  }
  | {
    kind: 'roster_player';
    rosterPlayerId: string;
    name: string;
    position: string;
    teamName: string;
  }
  | {
    kind: 'member';
    displayName: string;
    age: number | null;
    sex: string | null;
    joinDate: string | null;
  };

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

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user) throw redirect('/login');

  const userName =
    (typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : null) ??
    (typeof user?.email === 'string' && user.email.trim() ? user.email.trim() : null);
  const userId =
    (typeof user?.id === 'string' && user.id.trim() ? user.id.trim() : null) ??
    (typeof user?.email === 'string' && user.email.trim() ? user.email.trim() : null);
  if (!userId) throw redirect('/login');

  const groups = user.groups ?? [];
  const isAdmin = groups.includes('admin');
  const backendBaseUrl = process.env.BACKEND_URL || 'http://localhost:3001';

  let profile: ProfileSelf | null = null;
  let loadError: string | null = null;
  try {
    const pr = await fetch(
      `${backendBaseUrl}/api/profile/self?userId=${encodeURIComponent(userId)}`
    );
    if (pr.ok) {
      profile = (await pr.json()) as ProfileSelf;
    } else {
      loadError = 'Could not load your profile from the server.';
    }
  } catch {
    loadError = 'Could not load your profile from the server.';
  }

  let rosterPlayerModel: PlayerPageViewModel | null = null;
  if (profile?.kind === 'roster_player') {
    const rid = profile.rosterPlayerId;
    try {
      const r = await fetch(`${backendBaseUrl}/api/player/${encodeURIComponent(rid)}`);
      if (r.ok) {
        const raw = (await r.json()) as Record<string, unknown>;
        rosterPlayerModel = buildViewModelFromApi(raw);
      }
    } catch {
      rosterPlayerModel = null;
    }
    if (!rosterPlayerModel) {
      const mock = PLAYERS_BY_ID[rid];
      rosterPlayerModel = mock ? buildViewModelFromMock(mock) : null;
    }
  }

  return {
    profile,
    loadError,
    userId,
    userName: userName ?? '',
    backendBaseUrl,
    isAdmin,
    rosterPlayerModel,
  };
}

function formatJoinDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return String(iso).slice(0, 10);
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date(t)
  );
}

function formatNoteDate(iso: string) {
  const t = Date.parse(String(iso || ''));
  if (!Number.isFinite(t)) return String(iso || '').slice(0, 10);
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date(t)
  );
}

function formatSexDisplay(sex: string | null | undefined): string {
  const s = String(sex ?? '').trim();
  if (!s) return '—';
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function AccountDeleteButton({
  backendBaseUrl,
  userId,
}: {
  backendBaseUrl: string;
  userId: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const onClick = async () => {
    if (
      !window.confirm(
        'Permanently delete your account and related data? You will be signed out. This cannot be undone.'
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${backendBaseUrl}/api/account/delete-self`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!r.ok) {
        let msg = 'Delete failed.';
        try {
          const j = (await r.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          msg = (await r.text()) || msg;
        }
        window.alert(msg);
        return;
      }
      window.location.href = '/auth/logout';
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profileAccountActions">
      <button
        type="button"
        className="profileDeleteAccountBtn"
        disabled={busy}
        onClick={() => void onClick()}
      >
        {busy ? 'Deleting…' : 'Delete account'}
      </button>
    </div>
  );
}

const ProfilePage: React.FC = () => {
  const { profile, loadError, userId, userName, backendBaseUrl, isAdmin, rosterPlayerModel } =
    useLoaderData<typeof loader>();

  const [notes, setNotes] = React.useState<NoteRow[]>([]);
  const [loadingNotes, setLoadingNotes] = React.useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!profile || !userId) return;
    if (profile.kind !== 'coach') return;

    let cancelled = false;
    (async () => {
      setLoadingNotes(true);
      try {
        const r = await fetch(
          `${backendBaseUrl}/api/notes/coach-inbox?coachUserId=${encodeURIComponent(profile.coachUserId)}&viewerId=${encodeURIComponent(userId)}`
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
  }, [profile, userId, backendBaseUrl]);

  if (profile?.kind === 'roster_player' && rosterPlayerModel) {
    const notesRecipientId = String(rosterPlayerModel.profile.id);
    return (
      <PlayerProfileView
        model={rosterPlayerModel}
        userId={userId}
        userName={userName}
        backendBaseUrl={backendBaseUrl}
        isAdmin={isAdmin}
        assignedUserId={userId}
        canViewNotes
        canWriteNotes={false}
        notesRecipientId={notesRecipientId}
        notesUsePlayerThread
        showAdminRemove={false}
        showAccountDeleteButton
      />
    );
  }

  const renderAboutCard = (
    lead: string | null,
    p: {
      displayName?: string;
      age: number | null;
      sex: string | null;
      joinDate: string | null;
    }
  ) => (
    <section className="playerProfileSection profileAboutSection">
      <h2 className="playerProfileSectionTitle">About</h2>
      {lead ? <p className="profileAboutLead">{lead}</p> : null}
      <div className="profileAboutCard">
        <div className="profileAboutCardInner">
          {p.displayName ? (
            <div className="profileAboutRow">
              <span className="profileAboutLabel">Name</span>
              <span className="profileAboutValue">{p.displayName}</span>
            </div>
          ) : null}
          <div className="profileAboutRow">
            <span className="profileAboutLabel">Age</span>
            <span className="profileAboutValue">{p.age != null ? String(p.age) : '—'}</span>
          </div>
          <div className="profileAboutRow">
            <span className="profileAboutLabel">Sex</span>
            <span className="profileAboutValue">{formatSexDisplay(p.sex)}</span>
          </div>
          <div className="profileAboutRow profileAboutRow--last">
            <span className="profileAboutLabel">Join date</span>
            <span className="profileAboutValue">{formatJoinDate(p.joinDate)}</span>
          </div>
        </div>
      </div>
    </section>
  );

  const renderNotesReadOnly = (title: string) => (
    <section className="playerProfileSection">
      <h2 className="playerProfileSectionTitle">{title}</h2>
      <div className="playerProfileNotesPanel">
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
                    <div className="managePlayersNoteDate">
                      {formatNoteDate(String(n.date_created || ''))}
                    </div>
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
                      <span className="managePlayersNotePreview playerProfileNotePreviewInline">
                        {preview}…
                      </span>
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
  );

  return (
    <div className="comparePageWrapper">
      <header className="compareHeader">
        <Link to="/feed" className="compareBackBtn">
          ← Feed
        </Link>
      </header>

      {loadError || !profile ? (
        <>
          <div className="profileErrorBox">
            <p>{loadError || 'Profile unavailable.'}</p>
          </div>
          <AccountDeleteButton backendBaseUrl={backendBaseUrl} userId={userId} />
        </>
      ) : profile.kind === 'roster_player' && !rosterPlayerModel ? (
        <>
          <div className="profileErrorBox">
            <p>Could not load your roster player stats. Try again later.</p>
          </div>
          <AccountDeleteButton backendBaseUrl={backendBaseUrl} userId={userId} />
        </>
      ) : profile.kind === 'admin' ? (
        <>
          <section className="playerProfileHero">
            <div className="playerProfileHeroGlow" aria-hidden />
            <div className="playerProfileHeroInner playerProfileHeroInner--coachOnly">
              <div className="playerProfileHeroText">
                <h1 className="playerProfileName">{profile.displayName}</h1>
                <p className="playerProfileRole">{profile.teamName}</p>
                <p className="playerProfileContext">Upper Management</p>
              </div>
            </div>
          </section>
          <hr className="playerProfileHeroDivider" />
          <div className="playerProfileMain">
            {renderAboutCard(null, {
              displayName: profile.displayName,
              age: profile.age,
              sex: profile.sex,
              joinDate: profile.joinDate,
            })}
          </div>
          <AccountDeleteButton backendBaseUrl={backendBaseUrl} userId={userId} />
        </>
      ) : profile.kind === 'coach' ? (
        <>
          <section className="playerProfileHero">
            <div className="playerProfileHeroGlow" aria-hidden />
            <div className="playerProfileHeroInner playerProfileHeroInner--coachOnly">
              <div className="playerProfileHeroText">
                <h1 className="playerProfileName">{profile.displayName}</h1>
                <p className="playerProfileRole">{profile.role}</p>
                <p className="playerProfileContext">{profile.teamName}</p>
              </div>
            </div>
          </section>
          <hr className="playerProfileHeroDivider" />
          <div className="playerProfileMain">{renderNotesReadOnly('Notes from admin')}</div>
          <AccountDeleteButton backendBaseUrl={backendBaseUrl} userId={userId} />
        </>
      ) : profile.kind === 'member' ? (
        <>
          <section className="playerProfileHero">
            <div className="playerProfileHeroGlow" aria-hidden />
            <div className="playerProfileHeroInner playerProfileHeroInner--coachOnly">
              <div className="playerProfileHeroText">
                <h1 className="playerProfileName">{profile.displayName}</h1>
              </div>
            </div>
          </section>
          <hr className="playerProfileHeroDivider" />
          <div className="playerProfileMain">
            {renderAboutCard(null, {
              displayName: profile.displayName,
              age: profile.age,
              sex: profile.sex,
              joinDate: profile.joinDate,
            })}
          </div>
          <AccountDeleteButton backendBaseUrl={backendBaseUrl} userId={userId} />
        </>
      ) : null}
    </div>
  );
};

export default ProfilePage;
