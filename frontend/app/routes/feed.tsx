import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link, Form, redirect, useLoaderData, useRevalidator } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { getSession } from '~/services/session.server';
import UploadModal from '../components/UploadModal';
import { AddPlayersToTeamDialog } from '../components/AddPlayersToTeamDialog';
import './FeedPage.css';
import './ManagePlayersPage.css';

type FeedItemType =
  | 'game_result'
  | 'player_stat'
  | 'team_snapshot'
  | 'trend_insight'
  | 'news'
  | 'activity'
  | 'leaderboard'
  | 'upcoming'
  | 'comparison'
  | 'highlight'
  | 'personal_note';

interface FeedItem {
  id: string;
  type: FeedItemType;
  title: string;
  subtitle?: string;
  actor?: string;
  sortAt?: string;
  gameResult?: { teamA: string; teamB: string; scoreA: number | null; scoreB: number | null; date: string; takeaway?: string; videoUrl?: string; isUpcoming?: boolean; isLive?: boolean; whenLine?: string; nbaGameUrl?: string };
  playerStat?: { playerId?: string; playerName: string; position?: string; stats: { label: string; value: string | number; trend?: 'up' | 'down' | 'neutral' }[]; gameContext?: string };
  teamSnapshot?: { teamId?: string; teamName: string; record: string; metrics: { label: string; value: string }[]; trend: string };
  trendInsight?: { summary: string; externalUrl?: string };
  news?: { url: string; thumbnailUrl?: string; sourceDisplay?: string };
  activity?: { action: string; who: string };
  leaderboard?: { category: string; entries: { name: string; value: string | number }[] };
  upcoming?: { eventType: string; opponent: string; date: string; time?: string };
  comparison?: { label: string; statA: string; statB: string };
  highlight?: { description: string; gameContext: string; keyStat?: string; thumbnailUrl?: string; videoUrl?: string };
  personalNote?: {
    body: string;
    senderName: string;
    isRecipient: boolean;
  };
}

type CoachPlayer = {
  player_id: number;
  name: string;
  position?: string;
  overall_rank?: number | null;
  jersey?: string;
  height?: string;
  weight?: string;
  draft_year?: string;
  birthdate?: string;
  headshot_url?: string;
};

type StaffCoachRow = { role: string; name: string; userId: string };

type ApiFeedGame = { kind: 'game'; updated_at: string; game: Record<string, unknown> };
type ApiFeedArticle = {
  kind: 'article';
  updated_at: string;
  article_id: string;
  title: string;
  url: string;
  source?: string;
  thumbnail_url?: string;
};
type ApiFeedEntry = ApiFeedGame | ApiFeedArticle;

function formatGameDate(ymd: string): string {
  if (!ymd) return '';
  const t = Date.parse(`${ymd}T12:00:00`);
  if (!Number.isFinite(t)) return ymd;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatFeedNoteDate(iso: string): string {
  const t = Date.parse(String(iso || ''));
  if (!Number.isFinite(t)) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(t));
}

const FEED_NOTE_BODY_PREVIEW_MAX = 250;

function feedNoteBodyPreview(body: string): { preview: string; showReadMore: boolean } {
  const chars = Array.from(body);
  if (chars.length <= FEED_NOTE_BODY_PREVIEW_MAX) {
    return { preview: body, showReadMore: false };
  }
  return {
    preview: chars.slice(0, FEED_NOTE_BODY_PREVIEW_MAX).join(''),
    showReadMore: true,
  };
}

function buildGameWhenLine(ymd: string, statusText: string): string {
  const st = String(statusText || '').trim();
  if (!ymd) return st;
  const parsed = Date.parse(`${ymd}T12:00:00`);
  if (!Number.isFinite(parsed)) {
    return st ? `${ymd}, ${st}` : ymd;
  }
  const datePart = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  }).format(new Date(parsed));
  const m = st.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
  if (m) {
    const ap = m[3].toLowerCase();
    return `${datePart}, ${m[1]}.${m[2]}${ap} ET`;
  }
  if (st && !/^final|^half|^[qQ]\d|^end\b/i.test(st) && st.length < 56) {
    return `${datePart}, ${st}`;
  }
  return datePart;
}

const FEED_SCORE_TEAM_NAME_MAX = 30;

function clipFeedScoreTeamName(name: string): string {
  const s = String(name ?? '').trim();
  const chars = Array.from(s);
  if (chars.length <= FEED_SCORE_TEAM_NAME_MAX) return s;
  return `${chars.slice(0, FEED_SCORE_TEAM_NAME_MAX).join('')}…`;
}

function mapApiGameToFeedItem(row: ApiFeedGame): FeedItem {
  const g = row.game;
  const awayName = String(g.away_team_name || g.away_team || 'Away');
  const homeName = String(g.home_team_name || g.home_team || 'Home');
  const sa = g.away_score;
  const sb = g.home_score;
  const scoreA = sa === null || sa === undefined || Number.isNaN(Number(sa)) ? null : Number(sa);
  const scoreB = sb === null || sb === undefined || Number.isNaN(Number(sb)) ? null : Number(sb);
  const st = String(g.game_status ?? '').trim();
  const completed =
    st === '3' ||
    g.completed === true ||
    String(g.completed).toLowerCase() === 'true';
  let isLive: boolean;
  let isUpcoming: boolean;
  if (completed) {
    isLive = false;
    isUpcoming = false;
  } else if (st === '2') {
    isLive = true;
    isUpcoming = false;
  } else if (st === '1') {
    isLive = false;
    isUpcoming = true;
  } else if (!st) {
    const pa = scoreA != null ? Number(scoreA) : NaN;
    const pb = scoreB != null ? Number(scoreB) : NaN;
    const hasScore = Number.isFinite(pa) && Number.isFinite(pb) && (pa > 0 || pb > 0);
    isLive = hasScore;
    isUpcoming = !isLive;
  } else {
    isLive = false;
    isUpcoming = true;
  }
  const gid = String(g.nba_game_id || '');
  const id = `game-${gid || `${g.away_team}-${g.home_team}`}-${row.updated_at}`;
  const awaySlug = String(g.away_team || '').toLowerCase();
  const homeSlug = String(g.home_team || '').toLowerCase();
  const nbaGameUrl =
    gid && awaySlug && homeSlug
      ? `https://www.nba.com/game/${awaySlug}-vs-${homeSlug}-${gid}`
      : (typeof g.nba_game_url === 'string' ? g.nba_game_url : undefined);
  return {
    id,
    type: 'game_result',
    title: `${awayName} vs ${homeName}`,
    sortAt: String(row.updated_at || '') || undefined,
    gameResult: {
      teamA: awayName,
      teamB: homeName,
      scoreA,
      scoreB,
      date: formatGameDate(String(g.game_date || '')),
      takeaway: String(g.status || ''),
      isUpcoming,
      isLive,
      whenLine: buildGameWhenLine(String(g.game_date || ''), String(g.status || '')),
      ...(completed && nbaGameUrl ? { nbaGameUrl } : {}),
    },
  };
}

function formatNewsSource(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/-/g, '_');
  const map: Record<string, string> = {
    espn_rss: 'ESPN',
    cbs_rss: 'CBS',
    espn: 'ESPN',
    cbs: 'CBS',
    nba: 'NBA',
    nba_canada: 'Sporting News',
    bleacher_report: 'Bleacher Report',
    slam: 'SLAM',
    yahoo: 'Yahoo Sports',
  };
  if (map[key]) return map[key];
  const stripped = key.replace(/_rss$/, '').replace(/_/g, ' ');
  return stripped
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function mapApiArticleToFeedItem(a: ApiFeedArticle): FeedItem {
  const thumb = typeof a.thumbnail_url === 'string' && a.thumbnail_url.trim() ? a.thumbnail_url.trim() : undefined;
  const src = typeof a.source === 'string' && a.source.trim() ? formatNewsSource(a.source) : undefined;
  return {
    id: `article-${a.article_id}`,
    type: 'news',
    title: a.title,
    sortAt: String(a.updated_at || '') || undefined,
    news: { url: a.url, ...(thumb ? { thumbnailUrl: thumb } : {}), ...(src ? { sourceDisplay: src } : {}) },
  };
}

function mapFeedEntry(e: ApiFeedEntry): FeedItem | null {
  if (e.kind === 'game') return mapApiGameToFeedItem(e);
  if (e.kind === 'article') return mapApiArticleToFeedItem(e);
  return null;
}

function mapFeedApiList(arr: unknown): FeedItem[] {
  if (!Array.isArray(arr)) return [];
  const out: FeedItem[] = [];
  for (const x of arr) {
    const item = mapFeedEntry(x as ApiFeedEntry);
    if (!item) continue;
    if (item.type === 'upcoming') continue;
    if (item.type === 'game_result' && item.gameResult?.isUpcoming) continue;
    out.push(item);
  }
  return out;
}

type FeedNoteRow = {
  note_id?: string;
  notes_id?: string;
  sender_id: string;
  sender_name?: string;
  recipient_id: string;
  note_content: string;
  date_created: string;
};

function utf8ToBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function coachStaffPathSegment(role: string): string {
  return `for-role-${utf8ToBase64Url(String(role))}`;
}

function feedSortKey(item: FeedItem): string {
  if (item.sortAt != null && String(item.sortAt).trim() !== '') return String(item.sortAt);
  return '1970-01-01T00:00:00.000Z';
}

function mapFeedNoteToFeedItem(
  n: FeedNoteRow,
  ctx: {
    viewerUserId: string;
    playerProfileId: string | null;
  }
): FeedItem {
  const nid = String(n.note_id || n.notes_id || '').trim();
  const recipient = String(n.recipient_id || '').trim();
  const isRecipient =
    (!!ctx.playerProfileId && recipient === ctx.playerProfileId) ||
    recipient === ctx.viewerUserId;
  return {
    id: `note-${nid || `${n.sender_id}-${n.date_created}`}`,
    type: 'personal_note',
    title: `From ${n.sender_name || n.sender_id}`,
    sortAt: String(n.date_created || '') || undefined,
    personalNote: {
      body: String(n.note_content ?? ''),
      senderName: String(n.sender_name || n.sender_id || ''),
      isRecipient,
    },
  };
}

function mergeFeedWithNotes(
  feed: FeedItem[],
  notes: FeedNoteRow[],
  ctx: {
    viewerUserId: string;
    playerProfileId: string | null;
  }
): FeedItem[] {
  if (notes.length === 0) return feed;
  const noteItems = notes.map((n) => mapFeedNoteToFeedItem(n, ctx));
  const merged = [...feed, ...noteItems];
  merged.sort((a, b) => feedSortKey(b).localeCompare(feedSortKey(a)));
  return merged;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user) throw redirect('/login');
  const groups = user?.groups ?? [];
  const isAdmin = groups.includes('admin');
  const isCoach = groups.includes('coaches');
  const isPlayer = groups.includes('player') || groups.includes('players');
  const userId =
    (typeof user?.id === 'string' && user.id.trim() ? user.id.trim() : null) ??
    (typeof user?.email === 'string' && user.email.trim() ? user.email.trim() : null);
  const backendBaseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  let feedForYou: FeedItem[] = [];
  let coachPlayers: CoachPlayer[] = [];

  try {
    const r = await fetch(`${backendBaseUrl}/api/feed`);
    if (r.ok) {
      const data = (await r.json()) as { forYou?: unknown };
      feedForYou = mapFeedApiList(data.forYou);
    }
  } catch {
    feedForYou = [];
  }
  // Always merge notes for any signed-in userId. Backend only returns notes for this viewer
  // (coach inbox, linked player thread, etc.). Do not gate on Cognito groups: roster-linked
  // accounts may not have `player` / `players` in groups but still see notes on /profile.
  if (userId) {
    try {
      const nr = await fetch(
        `${backendBaseUrl}/api/notes/feed-for-viewer?viewerId=${encodeURIComponent(userId)}`
      );
      if (nr.ok) {
        const nd = (await nr.json()) as { notes?: FeedNoteRow[]; playerProfileId?: string | null };
        const rawPid =
          nd.playerProfileId != null && String(nd.playerProfileId).trim() !== ''
            ? String(nd.playerProfileId).trim()
            : null;
        const notes = Array.isArray(nd.notes) ? nd.notes : [];
        feedForYou = mergeFeedWithNotes(feedForYou, notes, {
          viewerUserId: userId,
          playerProfileId: rawPid,
        });
      }
    } catch {
    }
  }
  if (isCoach && userId) {
    try {
      const r = await fetch(`${backendBaseUrl}/api/players/by-coach?coachId=${encodeURIComponent(userId)}`);
      if (r.ok) {
        const data = (await r.json()) as { players?: CoachPlayer[] };
        coachPlayers = Array.isArray(data.players) ? data.players : [];
      }
    } catch {
      coachPlayers = [];
    }
  }

  let adminCoaches: StaffCoachRow[] = [];
  let adminTeamPlayers: CoachPlayer[] = [];
  if (isAdmin && userId) {
    const [usersRes, coachesRes, playersByAdminRes] = await Promise.allSettled([
      fetch(`${backendBaseUrl}/api/users`),
      fetch(`${backendBaseUrl}/api/coaches?adminId=${encodeURIComponent(userId)}`),
      fetch(`${backendBaseUrl}/api/players/by-admin?adminId=${encodeURIComponent(userId)}`),
    ]);

    let adminUsers: { id: string; name: string }[] = [];
    if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
      const rows = (await usersRes.value.json()) as Record<string, unknown>[];
      adminUsers = rows
        .map((row) => {
          const id = String(row.userId ?? row.id ?? '').trim();
          const name = String(row.name ?? row.displayName ?? row.email ?? id).trim();
          return { id, name };
        })
        .filter((u) => u.name && u.id && u.id !== userId);
    }

    if (coachesRes.status === 'fulfilled' && coachesRes.value.ok) {
      const staff = (await coachesRes.value.json()) as Record<string, string>;
      const nameById = new Map(adminUsers.map((u) => [u.id, u.name]));
      adminCoaches = Object.entries(staff)
        .map(([role, uid]) => ({
          role,
          name: nameById.get(uid) ?? uid,
          userId: String(uid ?? '').trim(),
        }))
        .filter((c) => Boolean(c.userId));
    }

    if (playersByAdminRes.status === 'fulfilled' && playersByAdminRes.value.ok) {
      const data = (await playersByAdminRes.value.json()) as { players?: CoachPlayer[] };
      adminTeamPlayers = Array.isArray(data.players) ? data.players : [];
    }
  }

  return {
    isAdmin,
    isCoach,
    userId,
    backendBaseUrl,
    feedForYou,
    coachPlayers,
    adminCoaches,
    adminTeamPlayers,
  };
}

type CoachTabId = 'team' | 'news';

function getYouTubeEmbedId(url: string): string | null {
  try {
    if (/youtube\.com\/watch\?v=/.test(url)) return new URL(url).searchParams.get('v');
    if (/youtube\.com\/embed\//.test(url)) return url.split('/embed/')[1]?.split('?')[0] ?? null;
    if (/youtu\.be\//.test(url)) return url.split('youtu.be/')[1]?.split('?')[0] ?? null;
  } catch { return null; }
  return null;
}

function InlinePlayer({ url }: { url: string }) {
  const ytId = getYouTubeEmbedId(url);
  if (ytId) {
    const watchUrl = `https://www.youtube.com/watch?v=${ytId}`;
    const thumbUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    return (
      <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="feedYoutubeThumbLink">
        <img src={thumbUrl} alt="" className="feedInlinePlayer" />
        <span className="feedYoutubePlayIcon" aria-hidden>▶</span>
      </a>
    );
  }
  return (
    <div className="feedInlinePlayerWrap">
      <video className="feedInlinePlayer" src={url} controls />
    </div>
  );
}

function feedTypeBadge(item: FeedItem): string {
  if (item.type === 'personal_note') return 'Note';
  if (item.type === 'news') return 'News';
  if (item.type === 'game_result' && item.gameResult?.isLive) return 'Live';
  return item.type.replace(/_/g, ' ');
}

function NewsThumb({ src }: { src: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible || !src) return null;
  return (
    <img
      src={src}
      alt=""
      className="feedNewsThumb"
      loading="lazy"
      decoding="async"
      onError={() => setVisible(false)}
    />
  );
}

function FeedCard({
  item,
  onOpenRecipientNote,
}: {
  item: FeedItem;
  onOpenRecipientNote?: (d: { senderName: string; body: string; dateLabel?: string }) => void;
}) {
  const trendSym = (t: 'up' | 'down' | 'neutral') => (t === 'up' ? '↑' : t === 'down' ? '↓' : '−');
  const playerId = item.type === 'player_stat' ? item.playerStat?.playerId : undefined;
  const teamId = item.type === 'team_snapshot' ? item.teamSnapshot?.teamId : undefined;
  const newsUrl = item.type === 'news' ? item.news?.url : undefined;
  const completedGameUrl =
    item.type === 'game_result' &&
      item.gameResult &&
      !item.gameResult.isUpcoming &&
      item.gameResult.nbaGameUrl
      ? item.gameResult.nbaGameUrl
      : undefined;
  const cardLinkUrl = newsUrl || completedGameUrl;

  const personalNoteBodyPreview =
    item.type === 'personal_note' && item.personalNote
      ? feedNoteBodyPreview(item.personalNote.body)
      : null;

  const cardContent = (
    <div className="feedCard">
      <div className="feedCardHeader">
        <span className="feedTypeLabel">{feedTypeBadge(item)}</span>
      </div>
      {item.type === 'news' && item.news ? (
        <h3
          className={
            item.news.thumbnailUrl
              ? 'feedCardTitle feedCardTitle--newsWithThumb'
              : 'feedCardTitle'
          }
        >
          {item.title}
          {item.news.sourceDisplay ? (
            <>
              {' '}
              — <span className="feedNewsSource">{item.news.sourceDisplay}</span>
            </>
          ) : null}
        </h3>
      ) : item.type !== 'game_result' ? (
        <h3 className="feedCardTitle">{item.title}</h3>
      ) : null}
      {item.type === 'news' && item.news?.thumbnailUrl && (
        <div className="feedNewsThumbWrap">
          <NewsThumb src={item.news.thumbnailUrl} />
        </div>
      )}
      {item.actor && <div className="feedActor">{item.actor}</div>}

      {item.type === 'game_result' && item.gameResult && !item.gameResult.isUpcoming && (
        <div className="feedGameResult">
          <div className="feedScoreLine">
            <span className="feedScoreTeam feedScoreTeam--away" title={item.gameResult.teamA}>
              {clipFeedScoreTeamName(item.gameResult.teamA)}
            </span>
            <strong className="feedScoreCenter">
              {item.gameResult.scoreA ?? '–'} – {item.gameResult.scoreB ?? '–'}
            </strong>
            <span className="feedScoreTeam feedScoreTeam--home" title={item.gameResult.teamB}>
              {clipFeedScoreTeamName(item.gameResult.teamB)}
            </span>
          </div>
          <div className="feedMeta">{item.gameResult.date}{item.gameResult.takeaway ? ` · ${item.gameResult.takeaway}` : ''}</div>
          {item.gameResult.videoUrl && <InlinePlayer url={item.gameResult.videoUrl} />}
        </div>
      )}

      {item.type === 'player_stat' && item.playerStat && (
        <div className="feedPlayerStat">
          {item.playerStat.gameContext && <div className="feedSubtitle">{item.playerStat.gameContext}</div>}
          <div className="feedMetricsGrid">
            {item.playerStat.stats.map((s, i) => (
              <div key={i} className="feedMetricItem">
                <small>{s.label}</small>
                <span>{s.value}{s.trend ? ` ${trendSym(s.trend)}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {item.type === 'team_snapshot' && item.teamSnapshot && (
        <div className="feedTeamSnapshot">
          <div className="feedRecord">{item.teamSnapshot.teamName} · {item.teamSnapshot.record}</div>
          <div className="feedTrend">{item.teamSnapshot.trend}</div>
          <div className="feedMetricsGrid">
            {item.teamSnapshot.metrics.map((m, i) => (
              <div key={i} className="feedMetricItem"><small>{m.label}</small><span>{m.value}</span></div>
            ))}
          </div>
        </div>
      )}

      {item.type === 'trend_insight' && item.trendInsight && (
        item.trendInsight.externalUrl ? (
          <a href={item.trendInsight.externalUrl} target="_blank" rel="noopener noreferrer" className="feedSummary">{item.trendInsight.summary}</a>
        ) : (
          <p className="feedSummary">{item.trendInsight.summary}</p>
        )
      )}

      {item.type === 'activity' && item.activity && (
        <p className="feedSummary">{item.activity.who} {item.activity.action}</p>
      )}

      {item.type === 'leaderboard' && item.leaderboard && (
        <div className="feedLeaderboard">
          <div className="feedSubtitle">{item.leaderboard.category}</div>
          <ul className="feedLeaderList">
            {item.leaderboard.entries.map((e, i) => (
              <li key={i}>{e.name}: {e.value}</li>
            ))}
          </ul>
        </div>
      )}

      {item.type === 'comparison' && item.comparison && (
        <div className="feedComparison">
          <div className="feedComparisonLabel">{item.comparison.label}</div>
          <div className="feedComparisonStats">
            <span>{item.comparison.statA}</span>
            <span> vs </span>
            <span>{item.comparison.statB}</span>
          </div>
        </div>
      )}

      {item.type === 'highlight' && item.highlight && (
        <div className="feedHighlight">
          {item.highlight.videoUrl && <InlinePlayer url={item.highlight.videoUrl} />}
          {!item.highlight.videoUrl && item.highlight.thumbnailUrl && (
            <img src={item.highlight.thumbnailUrl} alt="" className="feedHighlightThumb" />
          )}
          <p className="feedSummary">{item.highlight.description}</p>
          <div className="feedMeta">{item.highlight.gameContext}{item.highlight.keyStat ? ` · ${item.highlight.keyStat}` : ''}</div>
        </div>
      )}

      {item.type === 'personal_note' && item.personalNote && personalNoteBodyPreview && (
        <div className="feedPersonalNote">
          {item.sortAt ? <div className="feedMeta">{formatFeedNoteDate(item.sortAt)}</div> : null}
          <p className="feedSummary feedPersonalNoteBody">
            {personalNoteBodyPreview.preview}
            {personalNoteBodyPreview.showReadMore ? (
              <>
                {' '}
                <span className="feedPersonalNoteReadMore"> ...Read more</span>
              </>
            ) : null}
          </p>
        </div>
      )}
    </div>
  );

  if (
    item.type === 'personal_note' &&
    item.personalNote?.isRecipient &&
    onOpenRecipientNote
  ) {
    const pn = item.personalNote;
    const dateLabel = item.sortAt ? formatFeedNoteDate(item.sortAt) : undefined;
    return (
      <button
        type="button"
        className="feedCardLink feedCardNoteOpen"
        onClick={() =>
          onOpenRecipientNote({
            senderName: pn.senderName,
            body: pn.body,
            dateLabel,
          })
        }
      >
        {cardContent}
      </button>
    );
  }

  if (cardLinkUrl) {
    return (
      <a href={cardLinkUrl} target="_blank" rel="noopener noreferrer" className="feedCardLink">
        {cardContent}
      </a>
    );
  }
  if (playerId) return <Link to={`/player/${playerId}`} className="feedCardLink">{cardContent}</Link>;
  if (teamId) return <Link to={`/team/${teamId}`} className="feedCardLink">{cardContent}</Link>;
  return cardContent;
}

const FeedPage: React.FC = () => {
  const {
    isAdmin,
    isCoach,
    userId,
    backendBaseUrl,
    feedForYou,
    coachPlayers,
    adminCoaches,
    adminTeamPlayers,
  } = useLoaderData<typeof loader>();
  const [coachTab, setCoachTab] = useState<CoachTabId>('team');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [addPlayersOpen, setAddPlayersOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [recipientNoteDialog, setRecipientNoteDialog] = useState<{
    senderName: string;
    body: string;
    dateLabel?: string;
  } | null>(null);
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  useEffect(() => {
    if (!profileDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [profileDropdownOpen]);

  useEffect(() => {
    if (!recipientNoteDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRecipientNoteDialog(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [recipientNoteDialog]);

  const showTeamNewsTabs = isCoach || isAdmin;
  const onTeamTab = showTeamNewsTabs && coachTab === 'team';

  const items = onTeamTab ? [] : feedForYou;

  const positionSortKey = (pos: string | undefined) => {
    if (!pos || typeof pos !== 'string') return 999;
    const u = pos.toUpperCase();
    const order: [string, number][] = [
      ['PG', 1],
      ['SG', 2],
      ['SF', 3],
      ['PF', 4],
      ['C', 5],
      ['G-F', 6],
      ['F-G', 6],
      ['F-C', 6],
      ['C-F', 6],
      ['G', 7],
      ['F', 8],
    ];
    for (const [k, v] of order) {
      if (u.includes(k)) return v;
    }
    return 888;
  };

  const sortedCoachPlayers = useMemo(
    () =>
      [...(coachPlayers || [])].sort((a, b) => {
        const d = positionSortKey(a.position) - positionSortKey(b.position);
        if (d !== 0) return d;
        return String(a.name || '').localeCompare(String(b.name || ''));
      }),
    [coachPlayers]
  );

  const sortedAdminPlayers = useMemo(
    () =>
      [...(adminTeamPlayers || [])].sort((a, b) => {
        const d = positionSortKey(a.position) - positionSortKey(b.position);
        if (d !== 0) return d;
        return String(a.name || '').localeCompare(String(b.name || ''));
      }),
    [adminTeamPlayers]
  );

  return (
    <div className="feedPageWrapper">
      <header className="feedPageHeader">
        <div className="feedHeaderCenter" aria-hidden />
        <div className="feedProfileWrap" ref={profileDropdownRef}>
          <button type="button" className="feedProfileBtn" aria-label="Profile" aria-expanded={profileDropdownOpen} onClick={() => setProfileDropdownOpen(open => !open)}>
            <svg className="feedProfileIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </button>
          {profileDropdownOpen && (
            <div className="feedProfileDropdown">
              <Link to="/uploads" className="feedProfileDropdownItem" onClick={() => setProfileDropdownOpen(false)}>My Uploads</Link>
              <button type="button" className="feedProfileDropdownItem" onClick={() => { setProfileDropdownOpen(false); navigate('/profile'); }}>My Profile</button>
              <Form method="post" action="/auth/logout" style={{ display: 'contents' }}>
                <button type="submit" className="feedProfileDropdownItem">Sign Out</button>
              </Form>
            </div>
          )}
        </div>
      </header>

      <aside className="feedSidebar">
        <button
          type="button"
          className="feedSidebarBtn"
          onClick={() => setUploadModalOpen(true)}
        >
          Upload video
        </button>
        {isAdmin && (
          <Link to="/manage-coaches" className="feedSidebarBtn">Manage Coaches</Link>
        )}
        {isAdmin && (
          <button type="button" className="feedSidebarBtn" onClick={() => setAddPlayersOpen(true)}>
            Add Players to team
          </button>
        )}
        <Link to="/compare" className="feedSidebarBtn">Compare</Link>
        <Link to="/insights" className="feedSidebarBtn">Team Insights</Link>
        <Link to="/gambler" className="feedSidebarBtn">Gambling</Link>
      </aside>

      <div className={onTeamTab ? 'feedLayout feedLayout--coachTeam' : 'feedLayout'}>
        <div className="feedPage">
          {showTeamNewsTabs ? (
            <div className="feedTabs">
              <button
                type="button"
                className={`feedTab ${coachTab === 'team' ? 'feedTabActive' : ''}`}
                onClick={() => setCoachTab('team')}
              >
                Team
              </button>
              <button
                type="button"
                className={`feedTab ${coachTab === 'news' ? 'feedTabActive' : ''}`}
                onClick={() => setCoachTab('news')}
              >
                News
              </button>
            </div>
          ) : null}

          <main className={onTeamTab ? 'feedList feedList--coachTeam' : 'feedList'}>
            {isCoach && coachTab === 'team' ? (
              <>
                {(sortedCoachPlayers || []).length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem', padding: '0 12px' }}>No players found for your team.</p>
                ) : (
                  <div className="managePlayersGrid">
                    {sortedCoachPlayers.map((p) => (
                      <div key={p.player_id} className="managePlayersGridItem">
                        <Link
                          to={`/player/${p.player_id}`}
                          className="managePlayersCardNavLink"
                        >
                          <div className="managePlayersCardTopRow">
                            <div className="managePlayersCardDetails">
                              <div className="managePlayersNameRow">
                                <span className="managePlayersName">{p.name}</span>
                              </div>
                              <div className="managePlayersJerseyCol">
                                <span className="managePlayersPos">{p.position ?? '—'}</span>
                              </div>
                            </div>
                            {p.headshot_url ? (
                              <img src={p.headshot_url} alt={p.name} className="managePlayersHeadshot" />
                            ) : (
                              <div className="managePlayersHeadshotPlaceholder" aria-hidden />
                            )}
                          </div>
                          <div className="managePlayersCardStats">
                            <div className="managePlayersStatItem">
                              <span className="managePlayersStatLabel">Rank</span>
                              <span className="managePlayersStatValue">
                                {p.overall_rank != null && Number.isFinite(Number(p.overall_rank))
                                  ? `${p.overall_rank}`
                                  : '—'}
                              </span>
                            </div>
                            <div className="managePlayersStatItem">
                              <span className="managePlayersStatLabel">Jersey</span>
                              <span className="managePlayersStatValue">
                                {p.jersey != null && String(p.jersey).trim() !== '' ? `#${p.jersey}` : '—'}
                              </span>
                            </div>
                            <div className="managePlayersStatItem">
                              <span className="managePlayersStatLabel">Height</span>
                              <span className="managePlayersStatValue">{p.height ?? '—'}</span>
                            </div>
                            <div className="managePlayersStatItem">
                              <span className="managePlayersStatLabel">Weight</span>
                              <span className="managePlayersStatValue">{p.weight ? `${p.weight} lbs` : '—'}</span>
                            </div>
                            <div className="managePlayersStatItem">
                              <span className="managePlayersStatLabel">Draft</span>
                              <span className="managePlayersStatValue">{p.draft_year ?? '—'}</span>
                            </div>
                            <div className="managePlayersStatItem">
                              <span className="managePlayersStatLabel">Born</span>
                              <span className="managePlayersStatValue">{p.birthdate ? String(p.birthdate).substring(0, 10) : '—'}</span>
                            </div>
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : isAdmin && coachTab === 'team' ? (
              <>
                <h2 className="adminTeamSectionTitle">Coaches</h2>
                <hr className="adminTeamSectionDivider" />
                {adminCoaches.length === 0 ? (
                  <p className="adminTeamEmpty">No coaches assigned yet.</p>
                ) : (
                  <div className="adminCoachesGrid">
                    {adminCoaches.map((c) => (
                      <Link
                        key={c.userId}
                        to={`/coach/${coachStaffPathSegment(c.role)}`}
                        className="adminCoachCard adminCoachCardNavLink"
                      >
                        <div className="adminCoachCardBody">
                          <div className="adminCoachName">{c.name}</div>
                          <div className="adminCoachRole">{c.role}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                <h2 className="adminTeamSectionTitle">Players</h2>
                <hr className="adminTeamSectionDivider" />
                {sortedAdminPlayers.length === 0 ? (
                  <p className="adminTeamEmpty">No players on your team roster.</p>
                ) : (
                  <div className="managePlayersGrid">
                    {sortedAdminPlayers.map((p) => (
                      <div key={p.player_id} className="managePlayersGridItem">
                        <Link to={`/player/${p.player_id}`} className="managePlayersCardNavLink">
                          <div className="managePlayersCardTopRow">
                            <div className="managePlayersCardDetails">
                              <div className="managePlayersNameRow">
                                <span className="managePlayersName">{p.name}</span>
                              </div>
                              <div className="managePlayersJerseyCol">
                                <span className="managePlayersPos">{p.position ?? '—'}</span>
                              </div>
                            </div>
                            {p.headshot_url ? (
                              <img src={p.headshot_url} alt={p.name} className="managePlayersHeadshot" />
                            ) : (
                              <div className="managePlayersHeadshotPlaceholder" aria-hidden />
                            )}
                          </div>
                          <div className="managePlayersCardStats">
                            <div className="managePlayersStatItem">
                              <span className="managePlayersStatLabel">Rank</span>
                              <span className="managePlayersStatValue">
                                {p.overall_rank != null && Number.isFinite(Number(p.overall_rank))
                                  ? `${p.overall_rank}`
                                  : '—'}
                              </span>
                            </div>
                            <div className="managePlayersStatItem">
                              <span className="managePlayersStatLabel">Jersey</span>
                              <span className="managePlayersStatValue">
                                {p.jersey != null && String(p.jersey).trim() !== '' ? `#${p.jersey}` : '—'}
                              </span>
                            </div>
                            <div className="managePlayersStatItem">
                              <span className="managePlayersStatLabel">Height</span>
                              <span className="managePlayersStatValue">{p.height ?? '—'}</span>
                            </div>
                            <div className="managePlayersStatItem">
                              <span className="managePlayersStatLabel">Weight</span>
                              <span className="managePlayersStatValue">
                                {p.weight ? `${p.weight} lbs` : '—'}
                              </span>
                            </div>
                            <div className="managePlayersStatItem">
                              <span className="managePlayersStatLabel">Draft</span>
                              <span className="managePlayersStatValue">{p.draft_year ?? '—'}</span>
                            </div>
                            <div className="managePlayersStatItem">
                              <span className="managePlayersStatLabel">Born</span>
                              <span className="managePlayersStatValue">
                                {p.birthdate ? String(p.birthdate).substring(0, 10) : '—'}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {items.length === 0 && (
                  <div className="feedLoader">Nothing in feed yet.</div>
                )}
                {items.map((item) => (
                  <FeedCard
                    key={item.id}
                    item={item}
                    onOpenRecipientNote={(d) => setRecipientNoteDialog(d)}
                  />
                ))}
              </>
            )}
          </main>
        </div>
      </div>
      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadComplete={() => navigate('/uploads')}
        userId={userId ?? ''}
        backendBaseUrl={backendBaseUrl}
      />
      {isAdmin && userId && (
        <AddPlayersToTeamDialog
          open={addPlayersOpen}
          onClose={() => setAddPlayersOpen(false)}
          actorId={userId}
          backendBaseUrl={backendBaseUrl}
          onSuccess={() => {
            setAddPlayersOpen(false);
            revalidator.revalidate();
          }}
        />
      )}
      {recipientNoteDialog ? (
        <div
          className="feedNoteDialogBackdrop"
          role="presentation"
          onClick={() => setRecipientNoteDialog(null)}
        >
          <div
            className="feedNoteDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedNoteDialogTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="feedNoteDialogHeader">
              <h2 id="feedNoteDialogTitle" className="feedNoteDialogTitle">
                Note
              </h2>
              <div className="feedNoteDialogFrom">
                <span className="feedNoteDialogLabel">From</span>{' '}
                <span className="feedNoteDialogSender">{recipientNoteDialog.senderName}</span>
              </div>
              {recipientNoteDialog.dateLabel ? (
                <div className="feedNoteDialogDate">{recipientNoteDialog.dateLabel}</div>
              ) : null}
            </div>
            <div className="feedNoteDialogBodyScroll">
              <div className="feedNoteDialogBody">{recipientNoteDialog.body}</div>
            </div>
            <div className="feedNoteDialogActions">
              <button
                type="button"
                className="feedNoteDialogCloseBtn"
                onClick={() => setRecipientNoteDialog(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default FeedPage;
