const crypto = require('crypto');
const { BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { getArticles } = require('./newsArticles');
const { fetchRecentGamesLast3Days } = require('./recentGames');

const FEED_GAMES_META_ARTICLE_ID = '__nba_feed_games_meta__';

function maxGameDateYmd(games) {
  let maxYmd = null;
  for (const g of games || []) {
    const d = g && g.game_date;
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      if (maxYmd == null || d > maxYmd) maxYmd = d;
    }
  }
  return maxYmd;
}

function stableArticlePartitionKey(url, source) {
  const payload = JSON.stringify([String(url || ''), String(source || '')]);
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

function cleanItem(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function recentGamesPartitionId(games) {
  let sum = BigInt(0);
  const keys = [];
  for (const g of games) {
    const raw = g.nba_game_id != null && String(g.nba_game_id).trim() !== '' ? String(g.nba_game_id) : '';
    if (raw) {
      const digits = raw.replace(/\D/g, '');
      if (digits) sum += BigInt(digits);
      keys.push(`n:${raw}`);
    } else {
      keys.push(`k:${g.game_date}|${g.away_team}|${g.home_team}`);
    }
  }
  keys.sort();
  const basis = `${sum.toString()}#${keys.join('|')}`;
  return crypto.createHash('sha256').update(basis, 'utf8').digest('hex');
}

async function buildNbaFeedPayload() {
  const articlesRaw = await getArticles();
  const recent = await fetchRecentGamesLast3Days();
  const articles = articlesRaw.map((a) => ({
    ...a,
    article_id: stableArticlePartitionKey(a.url, a.source),
  }));
  return {
    articles,
    recent_games: recent.games,
  };
}

async function batchPutItems(docClient, tableName, items) {
  const CHUNK = 25;
  for (let i = 0; i < items.length; i += CHUNK) {
    let batch = items.slice(i, i + CHUNK).map((Item) => ({ PutRequest: { Item } }));
    let attempts = 0;
    while (batch.length > 0 && attempts < 10) {
      const res = await docClient.send(
        new BatchWriteCommand({
          RequestItems: { [tableName]: batch },
        })
      );
      const next = res.UnprocessedItems?.[tableName];
      batch = next || [];
      attempts += 1;
      if (batch.length > 0) {
        await new Promise((r) => setTimeout(r, 40 * 2 ** attempts));
      }
    }
    if (batch.length > 0) {
      throw new Error('feed BatchWrite has unprocessed items');
    }
  }
}

async function runNbaFeedSync(docClient, opts = {}) {
  const tableName = opts.tableName || process.env.FEED_TABLE || 'feed';
  const payload = await buildNbaFeedPayload();
  const updated_at = new Date().toISOString();
  const games = Array.isArray(payload.recent_games) ? payload.recent_games : [];
  const articleRows = payload.articles.map((a) =>
    cleanItem({
      article_id: a.article_id,
      title: a.title,
      url: a.url,
      source: a.source,
      thumbnail_url: a.thumbnail_url,
      updated_at,
    })
  );
  const metaRow = cleanItem({
    article_id: recentGamesPartitionId(games),
    recent_games: games,
    updated_at,
  });
  const metaPointer = cleanItem({
    article_id: FEED_GAMES_META_ARTICLE_ID,
    latest_game_date_ymd: maxGameDateYmd(games) || '',
    updated_at,
  });
  await batchPutItems(docClient, tableName, [...articleRows, metaRow, metaPointer]);
}

module.exports = {
  buildNbaFeedPayload,
  runNbaFeedSync,
  FEED_GAMES_META_ARTICLE_ID,
};
