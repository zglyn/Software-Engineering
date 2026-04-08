export interface PlayerStatsRow {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
}

export interface PlayerPageData {
  id: string;
  name: string;
  position: string;
  gameContext?: string;
  overallRanking?: number;
  stats: PlayerStatsRow[];
  shooting?: PlayerStatsRow[];
  advanced?: PlayerStatsRow[];
  trendSummary?: string;
  money?: number; // added
}

export interface TeamMetric {
  label: string;
  value: string;
}

export interface TeamRosterEntry {
  name: string;
  value: string | number;
}

export interface TeamPageData {
  id: string;
  name: string;
  record: string;
  overallRanking?: number;
  metrics: TeamMetric[];
  advancedMetrics?: TeamMetric[];
  trend: string;
  roster: TeamRosterEntry[];
  money?: number; // added
}

export const PLAYERS_BY_ID: Record<string, PlayerPageData> = {
  'lebron-james': {
    id: 'lebron-james',
    name: 'LeBron James',
    position: 'F',
    overallRanking: 5,
    gameContext: 'vs Celtics, Feb 26',
    stats: [
      { label: 'PTS', value: 28, trend: 'up' },
      { label: 'REB', value: 8, trend: 'neutral' },
      { label: 'AST', value: 7, trend: 'up' },
      { label: 'STL', value: 1 },
      { label: 'BLK', value: 0 }
    ],
    shooting: [
      { label: 'FG%', value: '52.1%', trend: 'up' },
      { label: '3P%', value: '36.2%', trend: 'neutral' },
      { label: 'FT%', value: '75.0%', trend: 'down' },
      { label: 'eFG%', value: '56.8%' },
      { label: 'TS%', value: '60.1%' }
    ],
    advanced: [
      { label: 'MPG', value: 35.2 },
      { label: 'TOV', value: 3.1, trend: 'neutral' },
      { label: 'PF', value: 1.8 },
      { label: '+/−', value: '+7.2', trend: 'up' }
    ],
    trendSummary: 'Averaging 28/8/7 over last 5 — above season average.',
    money: 40
  },
  'anthony-davis': {
    id: 'anthony-davis',
    name: 'Anthony Davis',
    position: 'F/C',
    overallRanking: 72,
    gameContext: 'vs Celtics, Feb 26',
    stats: [
      { label: 'PTS', value: 25, trend: 'up' },
      { label: 'REB', value: 12, trend: 'up' },
      { label: 'AST', value: 3, trend: 'neutral' },
      { label: 'BLK', value: 3, trend: 'neutral' }
    ],
    shooting: [
      { label: 'FG%', value: '55.3%', trend: 'up' },
      { label: '3P%', value: '32.1%', trend: 'neutral' },
      { label: 'FT%', value: '81.2%', trend: 'up' },
      { label: 'eFG%', value: '57.4%' }
    ],
    advanced: [
      { label: 'MPG', value: 34.0 },
      { label: 'TOV', value: 2.2 },
      { label: 'PF', value: 2.4 },
      { label: '+/−', value: '+5.8' }
    ],
    trendSummary: 'Rebounds trending up — 12.2 per game over last 10.',
    money: 35
  },
  'austin-reaves': {
    id: 'austin-reaves',
    name: 'Austin Reaves',
    position: 'G',
    overallRanking: 69,
    gameContext: 'vs Celtics, Feb 26',
    stats: [
      { label: 'PTS', value: 18, trend: 'up' },
      { label: 'AST', value: 6, trend: 'up' },
      { label: '3PM', value: 4, trend: 'neutral' }
    ],
    shooting: [
      { label: 'FG%', value: '48.2%' },
      { label: '3P%', value: '38.5%', trend: 'up' },
      { label: 'FT%', value: '86.1%' }
    ],
    advanced: [
      { label: 'MPG', value: 28.5 },
      { label: 'TOV', value: 1.5 },
      { label: '+/−', value: '+3.4' }
    ],
    trendSummary: 'Efficient from deep in recent outings.',
    money: 8
  },
  'jayson-tatum': {
    id: 'jayson-tatum',
    name: 'Jayson Tatum',
    position: 'F',
    overallRanking: 51,
    gameContext: 'vs Heat, Feb 26',
    stats: [
      { label: 'PTS', value: 31, trend: 'up' },
      { label: 'REB', value: 8, trend: 'neutral' },
      { label: 'AST', value: 5, trend: 'up' }
    ],
    shooting: [
      { label: 'FG%', value: '46.8%' },
      { label: '3P%', value: '35.4%', trend: 'up' },
      { label: 'FT%', value: '83.0%' },
      { label: 'eFG%', value: '54.2%' }
    ],
    advanced: [
      { label: 'MPG', value: 36.1 },
      { label: 'TOV', value: 2.8 },
      { label: '+/−', value: '+9.1', trend: 'up' }
    ],
    trendSummary: 'Trending above expected for rebounds this month.',
    money: 30
  },
  'jaylen-brown': {
    id: 'jaylen-brown',
    name: 'Jaylen Brown',
    position: 'G/F',
    overallRanking: 420,
    gameContext: 'vs Heat, Feb 26',
    stats: [
      { label: 'PTS', value: 24, trend: 'neutral' },
      { label: 'REB', value: 6, trend: 'down' }
    ],
    shooting: [
      { label: 'FG%', value: '49.1%' },
      { label: '3P%', value: '34.0%' },
      { label: 'FT%', value: '70.2%' }
    ],
    advanced: [
      { label: 'MPG', value: 33.2 },
      { label: 'TOV', value: 2.5 },
      { label: '+/−', value: '+6.0' }
    ],
    trendSummary: 'Steady scoring in the last five games.',
    money: 25
  }
};

export const TEAMS_BY_ID: Record<string, TeamPageData> = {
  'lakers': {
    id: 'lakers',
    name: 'Los Angeles Lakers',
    record: '35–25',
    overallRanking: 1,
    metrics: [
      { label: 'PPG', value: '114.2' },
      { label: 'Def Rtg', value: '110.1' },
      { label: 'Pace', value: '99.2' },
      { label: 'RPG', value: '44.1' },
      { label: 'APG', value: '26.8' },
      { label: '3P%', value: '35.8%' }
    ],
    advancedMetrics: [
      { label: 'Off Rtg', value: '115.2' },
      { label: 'Net Rtg', value: '+5.1' },
      { label: 'TOV%', value: '12.4%' },
      { label: 'Opp PPG', value: '109.1' }
    ],
    trend: 'Won 7 of last 10.',
    roster: [
      { name: 'LeBron James', value: '28 PTS' },
      { name: 'Anthony Davis', value: '25 PTS' },
      { name: 'Austin Reaves', value: '18 PTS' }
    ],
    money: 150
  },
  'celtics': {
    id: 'celtics',
    name: 'Boston Celtics',
    record: '42–18',
    metrics: [
      { label: 'PPG', value: '118.5' },
      { label: 'Def Rtg', value: '108.2' },
      { label: 'Pace', value: '100.1' },
      { label: 'RPG', value: '45.2' },
      { label: 'APG', value: '27.1' },
      { label: '3P%', value: '37.2%' }
    ],
    advancedMetrics: [
      { label: 'Off Rtg', value: '118.8' },
      { label: 'Net Rtg', value: '+10.6' },
      { label: 'TOV%', value: '11.8%' },
      { label: 'Opp PPG', value: '107.9' }
    ],
    trend: '3rd in East. Won 8 of last 10.',
    roster: [
      { name: 'Jayson Tatum', value: '31 PTS' },
      { name: 'Jaylen Brown', value: '24 PTS' }
    ],
    money: 140
  },
  'heat': {
    id: 'heat',
    name: 'Miami Heat',
    record: '32–28',
    metrics: [
      { label: 'PPG', value: '109.8' },
      { label: 'Def Rtg', value: '109.5' },
      { label: 'Pace', value: '97.8' },
      { label: 'RPG', value: '42.3' },
      { label: 'APG', value: '24.6' },
      { label: '3P%', value: '34.1%' }
    ],
    advancedMetrics: [
      { label: 'Off Rtg', value: '111.2' },
      { label: 'Net Rtg', value: '+1.7' },
      { label: 'TOV%', value: '13.2%' },
      { label: 'Opp PPG', value: '108.1' }
    ],
    trend: '5th in East.',
    roster: [],
    money: 110
  }
};