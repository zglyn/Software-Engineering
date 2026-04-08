import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link, Form, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { getSession } from '~/services/session.server';
import UploadModal from '../components/UploadModal';
import './FeedPage.css';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  const groups = user?.groups ?? [];
  const isAdmin = groups.includes('admin');
  const isCoach = groups.includes('coaches');
  return { isAdmin, isCoach };
}

type TabId = 'forYou' | 'following';

type FeedItemType =
  | 'game_result'
  | 'player_stat'
  | 'team_snapshot'
  | 'trend_insight'
  | 'activity'
  | 'leaderboard'
  | 'upcoming'
  | 'note'
  | 'comparison'
  | 'highlight';

interface FeedItem {
  id: string;
  type: FeedItemType;
  timestamp: string;
  title: string;
  subtitle?: string;
  actor?: string;
  gameResult?: { teamA: string; teamB: string; scoreA: number; scoreB: number; date: string; takeaway?: string; videoUrl?: string };
  playerStat?: { playerId?: string; playerName: string; position?: string; stats: { label: string; value: string | number; trend?: 'up' | 'down' | 'neutral' }[]; gameContext?: string };
  teamSnapshot?: { teamId?: string; teamName: string; record: string; metrics: { label: string; value: string }[]; trend: string };
  trendInsight?: { summary: string };
  activity?: { action: string; who: string };
  leaderboard?: { category: string; entries: { name: string; value: string | number }[] };
  upcoming?: { eventType: string; opponent: string; date: string; time?: string };
  note?: { snippet: string; author: string };
  comparison?: { label: string; statA: string; statB: string };
  highlight?: { description: string; gameContext: string; keyStat?: string; thumbnailUrl?: string; videoUrl?: string };
}

const FOR_YOU_MOCK: FeedItem[] = [
  {
    id: 'fy-1',
    type: 'game_result',
    title: 'Lakers vs Celtics',
    timestamp: '2 hours ago',
    gameResult: { teamA: 'Lakers', teamB: 'Celtics', scoreA: 112, scoreB: 108, date: 'Feb 26', takeaway: '3rd straight win', videoUrl: 'https://www.youtube.com/watch?v=hB7CDrVnNCs' }
  },
  {
    id: 'fy-2',
    type: 'player_stat',
    title: 'LeBron James – last game',
    timestamp: '3 hours ago',
    actor: 'LeBron James',
    playerStat: {
      playerId: 'lebron-james',
      playerName: 'LeBron James',
      position: 'F',
      gameContext: 'vs Celtics, Feb 26',
      stats: [
        { label: 'PTS', value: 28, trend: 'up' },
        { label: 'REB', value: 8, trend: 'neutral' },
        { label: 'AST', value: 7, trend: 'up' }
      ]
    }
  },
  {
    id: 'fy-3',
    type: 'player_stat',
    title: 'Anthony Davis – vs Celtics',
    timestamp: '4 hours ago',
    actor: 'Anthony Davis',
    playerStat: {
      playerId: 'anthony-davis',
      playerName: 'Anthony Davis',
      position: 'F/C',
      gameContext: 'vs Celtics, Feb 26',
      stats: [
        { label: 'PTS', value: 25, trend: 'up' },
        { label: 'REB', value: 12, trend: 'up' },
        { label: 'BLK', value: 3, trend: 'neutral' }
      ]
    }
  },
  {
    id: 'fy-4',
    type: 'trend_insight',
    title: 'Player trend',
    timestamp: '6 hours ago',
    trendInsight: { summary: 'LeBron James averaging 28/8/7 over last 5 — above season average.' }
  },
  {
    id: 'fy-5',
    type: 'activity',
    title: 'New stats uploaded',
    timestamp: '8 hours ago',
    activity: { action: 'uploaded stats for', who: 'Coach Ham' }
  },
  {
    id: 'fy-6',
    type: 'leaderboard',
    title: 'Top scorers this week',
    timestamp: '10 hours ago',
    leaderboard: {
      category: 'Points',
      entries: [
        { name: 'LeBron James', value: 89 },
        { name: 'Anthony Davis', value: 76 },
        { name: 'Jayson Tatum', value: 71 }
      ]
    }
  },
  {
    id: 'fy-6b',
    type: 'team_snapshot',
    title: 'Lakers – team snapshot',
    timestamp: '10 hours ago',
    teamSnapshot: {
      teamId: 'lakers',
      teamName: 'Lakers',
      record: '35–25',
      metrics: [
        { label: 'PPG', value: '114.2' },
        { label: 'Def Rtg', value: '110.1' }
      ],
      trend: 'Won 7 of last 10.'
    }
  },
  {
    id: 'fy-7',
    type: 'comparison',
    title: 'Compare Players',
    timestamp: '12 hours ago',
    comparison: { label: 'LeBron James vs Anthony Davis', statA: '28 PPG · 8 REB · 7 AST', statB: '24 PPG · 12 REB · 3 AST' }
  },
  {
    id: 'fy-8',
    type: 'player_stat',
    title: 'Austin Reaves – vs Celtics',
    timestamp: '1 day ago',
    actor: 'Austin Reaves',
    playerStat: {
      playerId: 'austin-reaves',
      playerName: 'Austin Reaves',
      position: 'G',
      gameContext: 'vs Celtics, Feb 26',
      stats: [
        { label: 'PTS', value: 18, trend: 'up' },
        { label: 'AST', value: 6, trend: 'up' },
        { label: '3PM', value: 4, trend: 'neutral' }
      ]
    }
  },
  {
    id: 'fy-9',
    type: 'highlight',
    title: 'LeBron James – fast break finish',
    timestamp: '1 day ago',
    actor: 'LeBron James',
    highlight: { description: 'End-to-end drive and finish.', gameContext: 'vs Celtics, Feb 26', keyStat: 'eFG% 58', thumbnailUrl: 'https://img.youtube.com/vi/hB7CDrVnNCs/hqdefault.jpg', videoUrl: 'https://www.youtube.com/watch?v=hB7CDrVnNCs' }
  },
  {
    id: 'fy-10',
    type: 'trend_insight',
    title: 'Player trend',
    timestamp: '2 days ago',
    trendInsight: { summary: 'Anthony Davis rebounds trending up — 12.2 per game over last 10.' }
  }
];

const FOLLOWING_MOCK: FeedItem[] = [
  {
    id: 'fw-1',
    type: 'player_stat',
    title: 'Jayson Tatum – last game',
    timestamp: '1 hour ago',
    actor: 'Jayson Tatum',
    playerStat: {
      playerId: 'jayson-tatum',
      playerName: 'Jayson Tatum',
      position: 'F',
      gameContext: 'vs Heat, Feb 26',
      stats: [
        { label: 'PTS', value: 31, trend: 'up' },
        { label: 'REB', value: 8, trend: 'neutral' },
        { label: 'AST', value: 5, trend: 'up' }
      ]
    }
  },
  {
    id: 'fw-2',
    type: 'game_result',
    title: 'Celtics vs Heat',
    timestamp: '2 hours ago',
    actor: 'Celtics',
    gameResult: { teamA: 'Celtics', teamB: 'Heat', scoreA: 118, scoreB: 104, date: 'Feb 26', takeaway: 'W', videoUrl: 'https://www.youtube.com/watch?v=hB7CDrVnNCs' }
  },
  {
    id: 'fw-2b',
    type: 'team_snapshot',
    title: 'Celtics – team snapshot',
    timestamp: '2 hours ago',
    teamSnapshot: {
      teamId: 'celtics',
      teamName: 'Celtics',
      record: '42–18',
      metrics: [
        { label: 'PPG', value: '118.5' },
        { label: 'Def Rtg', value: '108.2' }
      ],
      trend: '3rd in East. Won 8 of last 10.'
    }
  },
  {
    id: 'fw-3',
    type: 'player_stat',
    title: 'Jaylen Brown – vs Heat',
    timestamp: '4 hours ago',
    actor: 'Jaylen Brown',
    playerStat: {
      playerId: 'jaylen-brown',
      playerName: 'Jaylen Brown',
      position: 'G/F',
      gameContext: 'vs Heat, Feb 26',
      stats: [
        { label: 'PTS', value: 24, trend: 'neutral' },
        { label: 'REB', value: 6, trend: 'down' }
      ]
    }
  },
  {
    id: 'fw-4',
    type: 'trend_insight',
    title: 'Player trend',
    timestamp: '6 hours ago',
    trendInsight: { summary: 'Jayson Tatum trending above expected for rebounds this month.' }
  },
  {
    id: 'fw-5',
    type: 'comparison',
    title: 'Compare Players',
    timestamp: '8 hours ago',
    comparison: { label: 'Jayson Tatum vs Jaylen Brown', statA: '31 PPG · 8 REB · 5 AST', statB: '24 PPG · 6 REB · 4 AST' }
  },
  {
    id: 'fw-6',
    type: 'highlight',
    title: 'Jayson Tatum – step-back three',
    timestamp: '10 hours ago',
    actor: 'Jayson Tatum',
    highlight: { description: 'Step-back three from the wing.', gameContext: 'vs Heat, Feb 26', keyStat: '3PM 5', thumbnailUrl: 'https://img.youtube.com/vi/hB7CDrVnNCs/hqdefault.jpg', videoUrl: 'https://www.youtube.com/watch?v=hB7CDrVnNCs' }
  },
  {
    id: 'fw-7',
    type: 'activity',
    title: 'New update',
    timestamp: '1 day ago',
    activity: { action: 'added a highlight for', who: 'Coach Mazzulla' }
  }
];

const PAGE_SIZE = 4;
const FOR_YOU_PAGES = Math.ceil(FOR_YOU_MOCK.length / PAGE_SIZE);

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
const FOLLOWING_PAGES = Math.ceil(FOLLOWING_MOCK.length / PAGE_SIZE);

function getForYouPage(virtualPage: number): FeedItem[] {
  const actualPage = virtualPage % FOR_YOU_PAGES;
  const start = actualPage * PAGE_SIZE;
  const slice = FOR_YOU_MOCK.slice(start, start + PAGE_SIZE);
  return slice.map((item, i) => ({ ...item, id: `fy-p${virtualPage}-${i}` }));
}

function getFollowingPage(virtualPage: number): FeedItem[] {
  const actualPage = virtualPage % FOLLOWING_PAGES;
  const start = actualPage * PAGE_SIZE;
  const slice = FOLLOWING_MOCK.slice(start, start + PAGE_SIZE);
  return slice.map((item, i) => ({ ...item, id: `fw-p${virtualPage}-${i}` }));
}

function FeedCard({ item }: { item: FeedItem }) {
  const trendSym = (t: 'up' | 'down' | 'neutral') => (t === 'up' ? '↑' : t === 'down' ? '↓' : '−');
  const playerId = item.type === 'player_stat' ? item.playerStat?.playerId : undefined;
  const teamId = item.type === 'team_snapshot' ? item.teamSnapshot?.teamId : undefined;

  const cardContent = (
    <div className="feedCard">
      <div className="feedCardHeader">
        <span className="feedTypeLabel">{item.type.replace('_', ' ')}</span>
        <span className="feedTimeLabel">{item.timestamp}</span>
      </div>
      <h3 className="feedCardTitle">{item.title}</h3>
      {item.actor && <div className="feedActor">{item.actor}</div>}

      {item.type === 'game_result' && item.gameResult && (
        <div className="feedGameResult">
          <div className="feedScoreLine">
            <span>{item.gameResult.teamA}</span>
            <strong>{item.gameResult.scoreA} – {item.gameResult.scoreB}</strong>
            <span>{item.gameResult.teamB}</span>
          </div>
          <div className="feedMeta">{item.gameResult.date}{item.gameResult.takeaway ? ` · ${item.gameResult.takeaway}` : ''}</div>
          {item.gameResult.videoUrl && (
            <InlinePlayer url={item.gameResult.videoUrl} />
          )}
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
        <p className="feedSummary">{item.trendInsight.summary}</p>
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

      {item.type === 'note' && item.note && (
        <p className="feedSummary">{item.note.snippet}</p>
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

  if (playerId) return <Link to={`/player/${playerId}`} className="feedCardLink">{cardContent}</Link>;
  if (teamId) return <Link to={`/team/${teamId}`} className="feedCardLink">{cardContent}</Link>;
  return cardContent;
}

const FeedPage: React.FC = () => {
  const { isAdmin, isCoach } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState<TabId>('forYou');
  const [forYouItems, setForYouItems] = useState<FeedItem[]>([]);
  const [followingItems, setFollowingItems] = useState<FeedItem[]>([]);
  const [forYouPage, setForYouPage] = useState(0);
  const [followingPage, setFollowingPage] = useState(0);
  const [loadingForYou, setLoadingForYou] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  const loadPage = useCallback((tab: TabId, page: number) => {
    if (tab === 'forYou') {
      setLoadingForYou(true);
      loadingRef.current = true;
      setTimeout(() => {
        const next = getForYouPage(page);
        setForYouItems(prev => (page === 0 ? next : [...prev, ...next]));
        setForYouPage(page);
        setLoadingForYou(false);
        loadingRef.current = false;
      }, 500);
    } else {
      setLoadingFollowing(true);
      loadingRef.current = true;
      setTimeout(() => {
        const next = getFollowingPage(page);
        setFollowingItems(prev => (page === 0 ? next : [...prev, ...next]));
        setFollowingPage(page);
        setLoadingFollowing(false);
        loadingRef.current = false;
      }, 500);
    }
  }, []);

  useEffect(() => {
    loadPage('forYou', 0);
  }, []);

  useEffect(() => {
    if (activeTab === 'following' && followingItems.length === 0 && !loadingFollowing) {
      loadPage('following', 0);
    }
  }, [activeTab, followingItems.length, loadingFollowing, loadPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        if (loadingRef.current) return;
        const loading = activeTab === 'forYou' ? loadingForYou : loadingFollowing;
        if (loading) return;
        const nextPage = activeTab === 'forYou' ? forYouPage + 1 : followingPage + 1;
        loadPage(activeTab, nextPage);
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeTab, forYouPage, followingPage, loadingForYou, loadingFollowing, loadPage]);

  const items = activeTab === 'forYou' ? forYouItems : followingItems;
  const loading = activeTab === 'forYou' ? loadingForYou : loadingFollowing;

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
        {isAdmin && (
          <Link to="/manage-coaches" className="feedSidebarBtn">Manage Coaches</Link>
        )}
        {isCoach && (
          <Link to="/manage-players" className="feedSidebarBtn">Manage Players</Link>
        )}
        <Link to="/compare" className="feedSidebarBtn">Compare</Link>
        <Link to="/insights" className="feedSidebarBtn">Team Insights</Link>
      </aside>

      <div className="feedLayout">
        <div className="feedPage">
      <div className="feedTabs">
        <button
          className={`feedTab ${activeTab === 'forYou' ? 'feedTabActive' : ''}`}
          onClick={() => setActiveTab('forYou')}
        >
          For You
        </button>
        <button
          className={`feedTab ${activeTab === 'following' ? 'feedTabActive' : ''}`}
          onClick={() => setActiveTab('following')}
        >
          Following
        </button>
      </div>

      <main className="feedList">
        {items.map((item, index) => (
          <FeedCard key={`${activeTab}-${index}`} item={item} />
        ))}
        <div ref={sentinelRef} className="feedSentinel" />
        {loading && <div className="feedLoader">Loading...</div>}
      </main>
        </div>
      </div>
      <button
        type="button"
        className="feedFloatingUpload"
        onClick={() => setUploadModalOpen(true)}
      >
        Upload video
      </button>
      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadComplete={(id) => navigate(`/video/${id}`)}
      />
    </div>
  );
};

export default FeedPage;
