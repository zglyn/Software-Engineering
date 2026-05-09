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
  | 'highlight';

interface FeedItem {
  id: string;
  type: FeedItemType;
  title: string;
  subtitle?: string;
  actor?: string;
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
    if (item) out.push(item);
  }
  return out;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user) throw redirect('/login');
  const groups = user?.groups ?? [];
  const isAdmin = groups.includes('admin');
  const isCoach = groups.includes('coaches');
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
  return { isAdmin, isCoach, userId, backendBaseUrl, feedForYou, coachPlayers };
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
  if (item.type === 'news') return 'News';
  if (item.type === 'game_result' && item.gameResult?.isUpcoming) return 'Upcoming';
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

function FeedCard({ item }: { item: FeedItem }) {
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

      {item.type === 'game_result' && item.gameResult && item.gameResult.isUpcoming && (
        <div className="feedGameResult feedGameResult--upcoming">
          <div className="feedUpcomingMatchup">
            <span className="feedTeamSide feedTeamSide--away">{item.gameResult.teamA}</span>
            <span className="feedVs">vs</span>
            <span className="feedTeamSide feedTeamSide--home">{item.gameResult.teamB}</span>
            {item.gameResult.whenLine ? (
              <div className="feedMeta feedMeta--when">{item.gameResult.whenLine}</div>
            ) : null}
          </div>
          {item.gameResult.videoUrl ? <InlinePlayer url={item.gameResult.videoUrl} /> : null}
        </div>
      )}

      {item.type === 'game_result' && item.gameResult && !item.gameResult.isUpcoming && (
        <div className="feedGameResult">
          <div className="feedScoreLine">
            <span>{item.gameResult.teamA}</span>
            <strong>{item.gameResult.scoreA ?? '–'} – {item.gameResult.scoreB ?? '–'}</strong>
            <span>{item.gameResult.teamB}</span>
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

      {item.type === 'upcoming' && item.upcoming && (
        <div className="feedUpcoming">
          <div>{item.upcoming.eventType} vs <strong>{item.upcoming.opponent}</strong></div>
          <div className="feedMeta">{item.upcoming.date}{item.upcoming.time ? ` · ${item.upcoming.time}` : ''}</div>
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
    </div>
  );

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
  const { isAdmin, isCoach, userId, backendBaseUrl, feedForYou, coachPlayers } = useLoaderData<typeof loader>();
  const [coachTab, setCoachTab] = useState<CoachTabId>('team');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [addPlayersOpen, setAddPlayersOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
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

  const items = isCoach && coachTab === 'team' ? [] : feedForYou;

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

  return (
    <div className="feedPageWrapper">
      <header className="feedPageHeader">
        <div className="feedHeaderCenter">
          <input type="search" placeholder="Search players, teams..." className="feedSearch" aria-label="Search" />
        </div>
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
        {isCoach && (
          <button type="button" className="feedSidebarBtn" onClick={() => setAddPlayersOpen(true)}>
            Add Players to team
          </button>
        )}
        <Link to="/compare" className="feedSidebarBtn">Compare</Link>
        <Link to="/insights" className="feedSidebarBtn">Team Insights</Link>
      </aside>

      <div className={isCoach && coachTab === 'team' ? 'feedLayout feedLayout--coachTeam' : 'feedLayout'}>
        <div className="feedPage">
          {isCoach ? (
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

          <main className={isCoach && coachTab === 'team' ? 'feedList feedList--coachTeam' : 'feedList'}>
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
            ) : (
              <>
                {items.length === 0 && (
                  <div className="feedLoader">Nothing in feed yet.</div>
                )}
                {items.map((item) => (
                  <FeedCard key={item.id} item={item} />
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
      {isCoach && userId && (
        <AddPlayersToTeamDialog
          open={addPlayersOpen}
          onClose={() => setAddPlayersOpen(false)}
          coachId={userId}
          backendBaseUrl={backendBaseUrl}
          onSuccess={() => {
            setAddPlayersOpen(false);
            revalidator.revalidate();
          }}
        />
      )}
    </div>
  );
};

export default FeedPage;
