import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PLAYERS_BY_ID, type PlayerPageData, type PlayerStatsRow } from '~/data/mockStats';

import '~/routes/ComparePage.css';
import '~/routes/ManagePlayersPage.css';
import '~/routes/PlayerStatsPage.css';
import '~/routes/Profile.css';

function trendSym(t: 'up' | 'down' | 'neutral') {
  return t === 'up' ? '↑' : t === 'down' ? '↓' : '−';
}

interface PlayerStats {
  ft0: number;
  ft1: number;
  p2_0: number;
  p2_1: number;
  p3_0: number;
  p3_1: number;
  total_points: number;
}

function pct(made: number, attempted: number): string {
  if (!attempted) return '-';
  return ((made / attempted) * 100).toFixed(1) + '%';
}

function deriveStats(s?: PlayerStats | null) {
  if (!s) return null;
  const fta = (s.ft0 ?? 0) + (s.ft1 ?? 0);
  const p2a = (s.p2_0 ?? 0) + (s.p2_1 ?? 0);
  const p3a = (s.p3_0 ?? 0) + (s.p3_1 ?? 0);
  return {
    'Total Points': s.total_points ?? '-',
    '2PM': s.p2_1 ?? 0,
    '2PA': p2a,
    '2P%': pct(s.p2_1 ?? 0, p2a),
    '3PM': s.p3_1 ?? 0,
    '3PA': p3a,
    '3P%': pct(s.p3_1 ?? 0, p3a),
    'FTM': s.ft1 ?? 0,
    'FTA': fta,
    'FT%': pct(s.ft1 ?? 0, fta),
  };
}

function parsePctString(v: string | number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.min(100, Math.max(0, v));
  const n = parseFloat(String(v).replace(/%/g, '').trim());
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

type NbaApiProfile = {
  draft_round?: string;
  draft_number?: string;
  headline?: { pts?: unknown; reb?: unknown; ast?: unknown; pie?: unknown };
};

function pickNbaApi(raw: unknown): NbaApiProfile | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return raw as NbaApiProfile;
}

function buildNbaHeadlineRows(nba?: NbaApiProfile): { label: string; value: string }[] {
  const hl = nba?.headline;
  if (!hl || typeof hl !== 'object') return [];
  const rows: { label: string; value: string }[] = [];
  const fmt = (v: unknown) => {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  };
  const pts = fmt(hl.pts);
  const reb = fmt(hl.reb);
  const ast = fmt(hl.ast);
  if (pts) rows.push({ label: 'PTS', value: pts });
  if (reb) rows.push({ label: 'REB', value: reb });
  if (ast) rows.push({ label: 'AST', value: ast });
  const pieRaw = hl.pie;
  if (pieRaw != null && String(pieRaw).trim() !== '') {
    const n = Number(pieRaw);
    rows.push({ label: 'PIE', value: Number.isFinite(n) ? n.toFixed(3) : String(pieRaw) });
  }
  return rows;
}

type DerivedStats = NonNullable<ReturnType<typeof deriveStats>>;

export type ProfileVm = {
  id: string;
  name: string;
  position: string;
  headshotUrl?: string;
  jersey?: string;
  teamRank?: number | null;
  height?: string;
  weight?: string;
  draftYear?: string;
  birthdate?: string;
  gameContext?: string;
  nba_api?: NbaApiProfile;
};

type PerformanceVm = {
  hasData: boolean;
  efficiency: { label: string; pct: number; display: string }[];
  volume: { label: string; made: number; att: number }[];
  nbaHeadline?: { label: string; value: string }[];
  trendNote?: string;
};

type MockLegacyVm = {
  stats: PlayerStatsRow[];
  shooting: PlayerStatsRow[];
  advanced: PlayerStatsRow[];
};

export type PlayerPageViewModel = {
  profile: ProfileVm;
  performance: PerformanceVm | null;
  mockLegacy: MockLegacyVm | null;
};

function buildPerformanceVm(
  d: DerivedStats | null,
  nba: NbaApiProfile | undefined,
  trendNote?: string
): PerformanceVm {
  const nbaHeadline = buildNbaHeadlineRows(nba);
  let efficiency: PerformanceVm['efficiency'] = [];
  let volume: PerformanceVm['volume'] = [];
  if (d) {
    efficiency = [
      { label: '2P%', pct: parsePctString(String(d['2P%'])), display: String(d['2P%']) },
      { label: '3P%', pct: parsePctString(String(d['3P%'])), display: String(d['3P%']) },
      { label: 'FT%', pct: parsePctString(String(d['FT%'])), display: String(d['FT%']) },
    ];
    volume = [
      { label: '2-point FG', made: Number(d['2PM']) || 0, att: Number(d['2PA']) || 0 },
      { label: '3-point FG', made: Number(d['3PM']) || 0, att: Number(d['3PA']) || 0 },
      { label: 'Free throws', made: Number(d['FTM']) || 0, att: Number(d['FTA']) || 0 },
    ];
  }
  const hasStoredShooting = d != null;
  const hasData =
    hasStoredShooting || nbaHeadline.length > 0 || Boolean(trendNote && trendNote.trim() !== '');
  return {
    hasData,
    efficiency,
    volume,
    nbaHeadline: nbaHeadline.length > 0 ? nbaHeadline : undefined,
    trendNote: trendNote && trendNote.trim() !== '' ? trendNote : undefined,
  };
}

export function buildViewModelFromApi(raw: Record<string, unknown>): PlayerPageViewModel {
  const id = String(raw.player_id ?? raw.id ?? '');
  const nba = pickNbaApi(raw.nba_api);
  const profile: ProfileVm = {
    id,
    name: String(raw.name ?? 'Player'),
    position: String(raw.position ?? '—'),
    headshotUrl: typeof raw.headshot_url === 'string' && raw.headshot_url.trim() ? raw.headshot_url.trim() : undefined,
    jersey: raw.jersey != null && String(raw.jersey).trim() !== '' ? String(raw.jersey) : undefined,
    teamRank:
      raw.overall_rank != null && Number.isFinite(Number(raw.overall_rank))
        ? Number(raw.overall_rank)
        : null,
    height: raw.height ? String(raw.height) : undefined,
    weight: raw.weight != null && String(raw.weight).trim() !== '' ? String(raw.weight) : undefined,
    draftYear: raw.draft_year ? String(raw.draft_year) : undefined,
    birthdate: raw.birthdate ? String(raw.birthdate).substring(0, 10) : undefined,
    gameContext: undefined,
    nba_api: nba,
  };
  const statsObj = raw.stats as PlayerStats | null | undefined;
  const d = deriveStats(statsObj ?? undefined);
  const performance = buildPerformanceVm(d, nba, undefined);
  return {
    profile,
    performance,
    mockLegacy: null,
  };
}

export function buildViewModelFromMock(p: PlayerPageData): PlayerPageViewModel {
  const shooting = p.shooting ?? [];
  const pctRows = shooting
    .filter((r) => /%/.test(String(r.value)))
    .slice(0, 5)
    .map((r) => ({
      label: r.label,
      pct: parsePctString(r.value),
      display: String(r.value),
    }));
  const hasPct = pctRows.length > 0;
  const hasBox = (p.stats?.length ?? 0) > 0;
  const basePerf = buildPerformanceVm(null, undefined, p.trendSummary);
  return {
    profile: {
      id: p.id,
      name: p.name,
      position: p.position,
      gameContext: p.gameContext,
      teamRank: p.overallRanking ?? null,
    },
    performance: {
      ...basePerf,
      hasData: basePerf.hasData || hasPct || hasBox,
      efficiency: pctRows,
    },
    mockLegacy: {
      stats: p.stats ?? [],
      shooting: p.shooting ?? [],
      advanced: p.advanced ?? [],
    },
  };
}

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

function EfficiencyBars({ rows }: { rows: { label: string; pct: number; display: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="playerProfileChartCard">
      <h3 className="playerProfileChartTitle">Shooting efficiency</h3>
      <div className="playerProfileBarList">
        {rows.map((row) => (
          <div key={row.label} className="playerProfileBarRow">
            <span className="playerProfileBarLabel">{row.label}</span>
            <div className="playerProfileBarTrack" role="presentation">
              <div className="playerProfileBarFill" style={{ width: `${Math.min(100, row.pct)}%` }} />
            </div>
            <span className="playerProfileBarVal">{row.display}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VolumeBars({ rows }: { rows: { label: string; made: number; att: number }[] }) {
  if (rows.length === 0 || rows.every((r) => r.att <= 0)) return null;
  const maxAtt = Math.max(...rows.map((r) => r.att), 1);
  return (
    <div className="playerProfileChartCard">
      <h3 className="playerProfileChartTitle">Shot volume</h3>
      <div className="playerProfileVolList">
        {rows.map((row) => {
          const attW = (row.att / maxAtt) * 100;
          const madePct = row.att > 0 ? (row.made / row.att) * 100 : 0;
          return (
            <div key={row.label} className="playerProfileVolBlock">
              <div className="playerProfileVolMeta">
                <span className="playerProfileVolLabel">{row.label}</span>
                <span className="playerProfileVolNums">
                  {row.made} / {row.att}
                </span>
              </div>
              <div className="playerProfileVolTrack" role="presentation">
                <div className="playerProfileVolAtt" style={{ width: `${attW}%` }}>
                  <div className="playerProfileVolMade" style={{ width: `${madePct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeagueSnapshotTable({ rows }: { rows: { label: string; value: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="playerProfileStatBlock">
      <h3 className="playerProfileStatBlockTitle">League snapshot</h3>
      <dl className="playerProfileStatDl">
        {rows.map((r) => (
          <div key={r.label} className="playerProfileStatDlRow">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function buildProfileRows(profile: ProfileVm): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (profile.teamRank != null && Number.isFinite(profile.teamRank)) {
    rows.push({ label: 'Team rank', value: String(profile.teamRank) });
  }
  if (profile.jersey != null && String(profile.jersey).trim() !== '') {
    rows.push({ label: 'Jersey', value: `#${profile.jersey}` });
  }
  if (profile.height) rows.push({ label: 'Height', value: profile.height });
  if (profile.weight != null && String(profile.weight).trim() !== '') {
    rows.push({ label: 'Weight', value: `${profile.weight} lbs` });
  }
  if (profile.birthdate) rows.push({ label: 'Birthdate', value: profile.birthdate });
  if (profile.draftYear) rows.push({ label: 'Draft year', value: profile.draftYear });
  const nba = profile.nba_api;
  if (nba?.draft_round) rows.push({ label: 'NBA draft round', value: String(nba.draft_round) });
  if (nba?.draft_number) rows.push({ label: 'NBA draft pick', value: String(nba.draft_number) });
  return rows;
}

function ProfileTable({ rows }: { rows: { label: string; value: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="playerProfileDetailGroup">
      <dl className="playerProfileDetailDl">
        {rows.map((r) => (
          <div key={r.label} className="playerProfileDetailDlRow">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MockSection({ title, rows }: { title: string; rows: PlayerStatsRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="playerProfileMockBlock">
      <h3 className="playerProfileMockTitle">{title}</h3>
      <div className="playerProfileMockGrid">
        {rows.map((s, i) => (
          <div key={`${title}-${i}`} className="playerProfileMockCell">
            <span className="playerProfileMockLab">{s.label}</span>
            <span className="playerProfileMockVal">
              {s.value}
              {s.trend ? ` ${trendSym(s.trend)}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export type PlayerProfileViewProps = {
  model: PlayerPageViewModel | null;
  userId: string;
  userName: string;
  backendBaseUrl: string;
  isAdmin: boolean;
  assignedUserId?: string;
  canViewNotes: boolean;
  canWriteNotes: boolean;
  notesRecipientId: string;
  notesUsePlayerThread: boolean;
  showAdminRemove: boolean;
  showAccountDeleteButton?: boolean;
};

export function PlayerProfileView({
  model,
  userId,
  userName,
  backendBaseUrl,
  isAdmin,
  assignedUserId,
  canViewNotes,
  canWriteNotes,
  notesRecipientId,
  notesUsePlayerThread,
  showAdminRemove,
  showAccountDeleteButton = false,
}: PlayerProfileViewProps) {
  const navigate = useNavigate();
  const [removeTeamBusy, setRemoveTeamBusy] = useState(false);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Record<string, boolean>>({});
  const [accountDeleting, setAccountDeleting] = useState(false);

  const notesListUrl = useCallback(() => {
    if (notesUsePlayerThread) {
      return `${backendBaseUrl}/api/notes/player-thread?playerId=${encodeURIComponent(notesRecipientId)}&viewerId=${encodeURIComponent(userId)}`;
    }
    return `${backendBaseUrl}/api/notes/by-recipient?recipientId=${encodeURIComponent(notesRecipientId)}`;
  }, [backendBaseUrl, notesRecipientId, notesUsePlayerThread, userId]);

  const formatNoteDate = (iso: string) => {
    const t = Date.parse(String(iso || ''));
    if (!Number.isFinite(t)) return String(iso || '').slice(0, 10);
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(
      new Date(t)
    );
  };

  useEffect(() => {
    if (!canViewNotes || !notesRecipientId) return;
    let cancelled = false;
    (async () => {
      setLoadingNotes(true);
      try {
        const r = await fetch(notesListUrl());
        const data = (await r.json().catch(() => ({}))) as { ok?: boolean; notes?: NoteRow[] };
        if (!cancelled) setNotes(Array.isArray(data.notes) ? data.notes : []);
      } finally {
        if (!cancelled) setLoadingNotes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canViewNotes, notesRecipientId, notesListUrl]);

  const deleteSelfAccount = useCallback(async () => {
    if (
      !window.confirm(
        'Permanently delete your account and related data? You will be signed out. This cannot be undone.'
      )
    ) {
      return;
    }
    setAccountDeleting(true);
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
      setAccountDeleting(false);
    }
  }, [backendBaseUrl, userId]);

  const postNote = async () => {
    if (!canWriteNotes || !noteDraft.trim() || !userId || !notesRecipientId) return;
    setSendingNote(true);
    try {
      await fetch(`${backendBaseUrl}/api/notes/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: userId,
          sender_name: userName || userId,
          recipient_id: notesRecipientId,
          note_content: noteDraft.trim(),
        }),
      });
      setNoteDraft('');
      const r = await fetch(notesListUrl());
      const data = (await r.json().catch(() => ({}))) as { notes?: NoteRow[] };
      setNotes(Array.isArray(data.notes) ? data.notes : []);
    } finally {
      setSendingNote(false);
    }
  };

  const deleteNote = async (nid: string) => {
    if (!canWriteNotes || !nid || !userId) return;
    setDeletingNoteId(nid);
    try {
      const r = await fetch(`${backendBaseUrl}/api/notes/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: nid, viewer_id: userId }),
      });
      if (r.ok) setNotes((prev) => prev.filter((n) => (n.note_id || n.notes_id) !== nid));
    } finally {
      setDeletingNoteId(null);
    }
  };

  const removeFromTeam = async () => {
    if (!isAdmin || !userId || !notesRecipientId || !assignedUserId) return;
    const ok = window.confirm(
      'Remove this user from the roster? Any coach notes for this player will be deleted.'
    );
    if (!ok) return;
    setRemoveTeamBusy(true);
    try {
      const r = await fetch(`${backendBaseUrl}/api/admin/player-unassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: userId, playerId: notesRecipientId }),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        window.alert(data.error || 'Could not remove from team.');
        return;
      }
      navigate('/feed');
    } finally {
      setRemoveTeamBusy(false);
    }
  };

  if (!model) {
    return (
      <div className="comparePageWrapper">
        <header className="compareHeader">
          <Link to="/feed" className="compareBackBtn">
            ← Feed
          </Link>
        </header>
        <div className="playerProfileEmpty">
          <p className="playerProfileEmptyMsg">Player not found.</p>
          <Link to="/feed" className="compareBackBtn">
            ← Feed
          </Link>
        </div>
      </div>
    );
  }

  const { profile, performance, mockLegacy } = model;
  const profileRows = buildProfileRows(profile);

  return (
    <div className="comparePageWrapper">
      <header className="compareHeader">
        <Link to="/feed" className="compareBackBtn">
          ← Feed
        </Link>
      </header>

      <section className="playerProfileHero">
        <div className="playerProfileHeroGlow" aria-hidden />
        <div className="playerProfileHeroInner">
          <div className="playerProfilePhotoWrap">
            {profile.headshotUrl ? (
              <img src={profile.headshotUrl} alt={profile.name} className="playerProfilePhoto" />
            ) : (
              <div className="playerProfilePhotoFallback" aria-hidden>
                {profile.name
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
          </div>
          <div className="playerProfileHeroText">
            <h1 className="playerProfileName">{profile.name}</h1>
            <p className="playerProfileRole">{profile.position}</p>
            {profile.gameContext && <p className="playerProfileContext">{profile.gameContext}</p>}
          </div>
        </div>
      </section>

      <div className="playerProfileMain">
        {profileRows.length > 0 && (
          <section className="playerProfileSection">
            <h2 className="playerProfileSectionTitle">Profile</h2>
            <ProfileTable rows={profileRows} />
          </section>
        )}

        {performance && performance.hasData && (
          <section className="playerProfileSection">
            <h2 className="playerProfileSectionTitle">Performance</h2>
            <div className="playerProfilePerfStack">
              {(performance.efficiency.length > 0 || performance.volume.some((v) => v.att > 0)) && (
                <div className="playerProfilePerfLayout">
                  <EfficiencyBars rows={performance.efficiency} />
                  <VolumeBars rows={performance.volume} />
                </div>
              )}
              {performance.nbaHeadline && performance.nbaHeadline.length > 0 && (
                <LeagueSnapshotTable rows={performance.nbaHeadline} />
              )}
              {performance.trendNote && (
                <div className="playerProfileTrendCard">
                  <h3 className="playerProfileTrendTitle">Summary</h3>
                  <p className="playerProfileTrendBody">{performance.trendNote}</p>
                </div>
              )}
              {performance.efficiency.length === 0 &&
                !performance.volume.some((v) => v.att > 0) &&
                (!performance.nbaHeadline || performance.nbaHeadline.length === 0) &&
                !performance.trendNote && (
                  <div className="playerProfileEmptyPerf">No performance data yet.</div>
                )}
            </div>
          </section>
        )}

        {canViewNotes && notesRecipientId && (
          <section className="playerProfileSection">
            <h2 className="playerProfileSectionTitle">Notes</h2>
            <div className="playerProfileNotesPanel">
              {canWriteNotes && (
                <>
                  <textarea
                    className="managePlayersDialogTextarea playerProfileNotesInput"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Write a note for this player…"
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
                          <div className="managePlayersNoteDate">
                            {formatNoteDate(String(n.date_created || ''))}
                          </div>
                          {canWriteNotes && userId === n.sender_id ? (
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
        )}

        {mockLegacy && (
          <section className="playerProfileSection">
            <h2 className="playerProfileSectionTitle">Game snapshot</h2>
            <div className="playerProfileMockWrap">
              <MockSection title="Box" rows={mockLegacy.stats} />
              <MockSection title="Shooting" rows={mockLegacy.shooting} />
              <MockSection title="Advanced" rows={mockLegacy.advanced} />
            </div>
          </section>
        )}

        {showAdminRemove && isAdmin && notesRecipientId && assignedUserId && (
          <section className="playerProfileSection playerProfileSection--adminActions">
            <button
              type="button"
              className="playerProfileRemoveTeamBtn"
              disabled={removeTeamBusy}
              onClick={() => void removeFromTeam()}
            >
              {removeTeamBusy ? 'Removing…' : 'Remove from team'}
            </button>
          </section>
        )}
      </div>

      {showAccountDeleteButton ? (
        <div className="profileAccountActions">
          <button
            type="button"
            className="profileDeleteAccountBtn"
            disabled={accountDeleting}
            onClick={() => void deleteSelfAccount()}
          >
            {accountDeleting ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
