const axios = require('axios');
const cheerio = require('cheerio');
const FETCH_TIMEOUT_MS = 9000;
const THUMB_PAGE_TIMEOUT_MS = 6500;
const rawArticleCap = Number(process.env.NBA_FEED_ARTICLE_LIMIT);
const FEED_ARTICLE_MAX = Number.isFinite(rawArticleCap)
  ? Math.min(12, Math.max(10, Math.floor(rawArticleCap)))
  : 12;
const FEED_TITLE_MAX = 100;
const axiosFetchOpts = {
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
};

function resolveAbsUrl(pageUrl, href) {
  if (!href || typeof href !== 'string') return '';
  const t = href.trim();
  if (!t) return '';
  try {
    return new URL(t, pageUrl).href;
  } catch {
    return /^https?:\/\//i.test(t) ? t : '';
  }
}

function pickOgImage($, pageUrl) {
  const tryAttrs = [
    () => $('meta[property="og:image:secure_url"]').attr('content'),
    () => $('meta[property="og:image"]').attr('content'),
    () => $('meta[name="twitter:image"]').attr('content'),
    () => $('meta[name="twitter:image:src"]').attr('content'),
    () => $('link[rel="image_src"]').attr('href'),
  ];
  for (const fn of tryAttrs) {
    const raw = fn();
    if (raw && typeof raw === 'string') {
      const abs = resolveAbsUrl(pageUrl, raw);
      if (abs) return abs;
    }
  }
  return '';
}

function hasArticleThumb(a) {
  return Boolean(a.thumbnail_url && String(a.thumbnail_url).trim());
}

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  let s = str;
  s = s.replace(/&#x([0-9a-fA-F]+);/gi, (_, h) => {
    const cp = parseInt(h, 16);
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
  });
  s = s.replace(/&#(\d+);/g, (_, d) => {
    const cp = parseInt(d, 10);
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
  });
  s = s.replace(/&nbsp;/gi, ' ');
  s = s.replace(/&amp;/g, '&');
  s = s.replace(/&lt;/g, '<');
  s = s.replace(/&gt;/g, '>');
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&apos;/g, "'");
  s = s.replace(/&#39;/g, "'");
  return s;
}

function pickBleacherArticleImage($, pageUrl) {
  const bad = /null\.png|\/nba\.png|logo|favicon/i;
  const header = $('[id="id/article/header/media/image_media/img"]').attr('src');
  if (header && !bad.test(header)) {
    const abs = resolveAbsUrl(pageUrl, header);
    if (abs) return abs;
  }
  const out = [];
  $('[id*="pinned_video"] img[src]').each((i, el) => {
    const raw = $(el).attr('src');
    if (!raw || bad.test(raw)) return;
    const abs = resolveAbsUrl(pageUrl, raw);
    if (abs) out.push(abs);
  });
  return out[0] || '';
}

function clipTitle(raw) {
  const t = decodeHtmlEntities(String(raw || ''))
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  if (t.length <= FEED_TITLE_MAX) return t;
  return t.slice(0, FEED_TITLE_MAX);
}

async function enrichArticlesFromWeb(articles) {
  const skipThumb = process.env.NBA_FEED_ARTICLE_THUMBNAILS === '0';
  const out = [];
  for (const a of articles) {
    const needCanonical = a.source === 'bleacher_report' || a.source === 'nba_canada';
    const wantThumbOnly = !skipThumb && !hasArticleThumb(a);
    if (!needCanonical && !wantThumbOnly) {
      out.push({ ...a, title: clipTitle(a.title) });
      continue;
    }
    try {
      const res = await axios.get(a.url, {
        ...axiosFetchOpts,
        timeout: THUMB_PAGE_TIMEOUT_MS,
        maxContentLength: 32 * 1024 * 1024,
        maxBodyLength: 32 * 1024 * 1024,
        validateStatus: (s) => s >= 200 && s < 400,
      });
      const ct = String(res.headers['content-type'] || '');
      if (ct.includes('image/')) {
        out.push({ ...a, title: clipTitle(a.title) });
        continue;
      }
      const html = typeof res.data === 'string' ? res.data : '';
      if (!html) {
        out.push({ ...a, title: clipTitle(a.title) });
        continue;
      }
      const $ = cheerio.load(html);
      let title = a.title;
      if (needCanonical) {
        if (a.source === 'bleacher_report') {
          const $titleEl = $('[id="id/article/header/title"]').first();
          let domT = $titleEl.text().trim();
          if (!domT && $titleEl.length) {
            domT = decodeHtmlEntities(($titleEl.html() || '').replace(/<[^>]+>/g, ' '))
              .replace(/\s+/g, ' ')
              .trim();
          }
          const ogT = decodeHtmlEntities($('meta[property="og:title"]').attr('content') || '').trim();
          title = domT.length >= ogT.length ? domT : ogT;
          if (!title) title = a.title;
        } else if (a.source === 'nba_canada') {
          const t = $('h1.text-headline.text-d3').first().text().trim();
          title = t || decodeHtmlEntities($('meta[property="og:title"]').attr('content') || '') || title;
        }
      }
      const next = { ...a, title: clipTitle(title) };
      const canSetThumb = !hasArticleThumb(a) && (!skipThumb || needCanonical);
      if (canSetThumb) {
        let im = '';
        if (a.source === 'bleacher_report') {
          im = pickBleacherArticleImage($, a.url);
        }
        if (!im) im = pickOgImage($, a.url);
        if (im) next.thumbnail_url = im;
      }
      out.push(next);
    } catch {
      out.push({ ...a, title: clipTitle(a.title) });
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return out;
}

function extractBleacherReportArticles(html, sourceName) {
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();
  $('a[href^="/articles/"]').each(function () {
    const href = $(this).attr('href');
    if (!href || !/^\/articles\/\d+-/.test(href)) return;
    const slug = href.replace(/^\/articles\/\d+-/, '').replace(/\/$/, '');
    const title = slug ? slug.replace(/-/g, ' ') : '';
    if (!title) return;
    let url;
    try {
      url = new URL(href.trim(), 'https://bleacherreport.com').href;
    } catch {
      return;
    }
    const key = url.split('?')[0].replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ title, url, source: sourceName });
  });
  return out;
}

function extractYahooNbaArticles(html, sourceName) {
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();
  const navRe = /^(scoreboard|schedule|standings|stats|teams|players|injuries|odds|draft|playoffs)$/i;
  $('a[href*="/nba/article/"], a[href*="/nba/breaking-news/article/"]').each(function () {
    const href = $(this).attr('href');
    if (!href) return;
    const title = $(this).text().trim();
    if (!title || title.length < 10 || navRe.test(title)) return;
    let url;
    try {
      url = new URL(href.trim(), 'https://sports.yahoo.com').href;
    } catch {
      return;
    }
    const key = url.split('?')[0].replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ title, url, source: sourceName });
  });
  return out;
}

const NBA_COM_NEWS_SLUG_BLOCK = new Set([
  'key-dates',
  'writers-archive',
  'nba-guide',
  'history',
  '2025-26-nba-player-pronunciation-guide',
]);

function extractNbaComNewsArticles(html, sourceName) {
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();
  $('a[href^="/news/"]').each(function () {
    const href = $(this).attr('href');
    if (!href) return;
    let url;
    try {
      url = new URL(href, 'https://www.nba.com').href;
    } catch {
      return;
    }
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    if (parts[0] !== 'news') return;
    if (parts.length < 2) return;
    if (parts[1] === 'category') return;
    if (NBA_COM_NEWS_SLUG_BLOCK.has(parts[1])) return;
    const title = $(this).text().trim();
    if (!title || title.length < 6) return;
    const key = url.split('?')[0].replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ title, url, source: sourceName });
  });
  return out;
}

function sportingNewsArticlePathOk(pathname) {
  if (!pathname.includes('/ca/nba/') || !pathname.includes('/news/')) return false;
  if (/\/news\/?$/.test(pathname)) return false;
  const parts = pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('news');
  return idx >= 0 && parts.length >= idx + 3;
}

function extractSportingNewsCaNbaArticles(html, sourceName) {
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();
  $('a[href*="/ca/nba/"]').each(function () {
    const href = $(this).attr('href');
    if (!href) return;
    let url;
    try {
      url = new URL(href.trim(), 'https://www.sportingnews.com').href;
    } catch {
      return;
    }
    if (!sportingNewsArticlePathOk(new URL(url).pathname)) return;
    let title = $(this).find('h3').first().text().trim();
    if (!title) title = $(this).find('h2').first().text().trim();
    if (!title || title.length < 8) return;
    const key = url.split('?')[0].replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ title, url, source: sourceName });
  });
  return out;
}

const websites = [
  {
    name: 'espn',
    address: 'https://www.espn.com/nba/',
    base: 'https://www.espn.com',
    selector: '.headlineStack__header + section > ul > li > a',
  },
  {
    name: 'bleacher_report',
    address: 'https://bleacherreport.com/nba',
    base: 'https://bleacherreport.com',
  },
  {
    name: 'yahoo',
    address: 'https://sports.yahoo.com/nba/',
    base: 'https://sports.yahoo.com',
  },
  {
    name: 'nba',
    address: 'https://www.nba.com/news/category/top-stories',
    base: 'https://www.nba.com',
  },
  {
    name: 'nba_canada',
    address: 'https://www.sportingnews.com/ca/nba/news',
    base: 'https://www.sportingnews.com',
  },
];

const rssFeeds = [
  {
    source: 'espn_rss',
    url: 'https://www.espn.com/espn/rss/nba/news',
  },
  {
    source: 'cbs_rss',
    url: 'https://www.cbssports.com/rss/headlines/nba/',
  },
];

const GOSSIP_REGEX =
  /\b(dating|girlfriend|boyfriend|divorce|wedding|spotted with|seen with|tiktok|onlyfans|reality tv|instagram model|relationship with|cheating on|affair with)\b|ride from|gave (him|her|them) a ride|gets a ride|got a ride|uber driver|lyft driver|personal life|off[- ]the[- ]court style|fashion week|red carpet/i;

const SPORTS_SIGNAL_REGEX =
  /\b(trade|traded|trading|re[- ]sign|sign(ing|ed)?\b|contract|extension|free agency|waiver|waived|buyout|injur(y|ies|ed)|suspension|suspended|fined|draft|playoff|finals|game recap|\brecap\b|box score|highlights|preview|standings|roster|stats|overtime|triple[- ]double|\bvs\.|\svs\.?\s|\d{2,3}\s*[-–]\s*\d{2,3}|\bscores\b|matchup|acquired|deal(s)?\b|rumor|rumour|coach(ing)?|ejected|flagrant|technical|mvp|all[- ]star|season opener|play[- ]in|seed(ing)?|eliminated|clinched)\b/i;

const TRUSTED_SOURCES = new Set([
  'nba',
  'nba_canada',
  'espn_rss',
  'cbs_rss',
  'espn',
  'bleacher_report',
  'yahoo',
]);

const NBA_URL_REGEX =
  /(\/nba\/|nba\.com\/(news|game|games|teams|standings|stats|players)|cbssports\.com\/nba|sportingnews\.com\/.*\/nba\/)/i;

const isHardNewsArticle = (article) => {
  const blob = `${article.title} ${article.url}`;
  if (GOSSIP_REGEX.test(blob)) return false;
  if (TRUSTED_SOURCES.has(article.source)) return true;
  if (NBA_URL_REGEX.test(article.url)) return true;
  if (SPORTS_SIGNAL_REGEX.test(blob)) return true;
  return false;
};

const filterHardNews = (articles) => articles.filter(isHardNewsArticle);

const dedupeByUrl = (articles) => {
  const seen = new Set();
  const out = [];
  for (const a of articles) {
    const key = String(a.url || '')
      .split('?')[0]
      .replace(/\/$/, '')
      .toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
};

function parseRssXml(xml, source) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const originalArticles = [];
  $('item').each(function () {
    const $item = $(this);
    const title = $item.find('title').first().text().trim();
    let link = $item.find('link').first().text().trim();
    if (!link) {
      link = $item.find('link').first().attr('href') || '';
    }
    let thumb = '';
    const mc = $item.find('media\\:content').first();
    if (mc.length) {
      thumb = mc.attr('url') || mc.attr('href') || '';
    }
    if (!thumb) {
      const enc = $item.find('enclosure[type*="image"], enclosure[type*="jpeg"], enclosure[type*="png"]').first();
      if (enc.length) thumb = enc.attr('url') || '';
    }
    if (!thumb) {
      const th = $item.find('thumbnail').first();
      if (th.length) thumb = th.attr('url') || '';
    }
    if (title && link) {
      const row = { title, url: link, source };
      if (thumb && typeof thumb === 'string') row.thumbnail_url = thumb.trim();
      originalArticles.push(row);
    }
  });
  return originalArticles;
}

const getRssFeed = async ({ url, source }) => {
  try {
    const res = await axios.get(url, axiosFetchOpts);
    return parseRssXml(res.data, source);
  } catch (err) {
    return [];
  }
};

function extractFromWebsiteHtml(website, html) {
  if (website.name === 'bleacher_report') {
    return extractBleacherReportArticles(html, website.name);
  }
  if (website.name === 'yahoo') {
    return extractYahooNbaArticles(html, website.name);
  }
  if (website.name === 'nba') {
    return extractNbaComNewsArticles(html, website.name);
  }
  if (website.name === 'nba_canada') {
    return extractSportingNewsCaNbaArticles(html, website.name);
  }
  const originalArticles = [];
  const $ = cheerio.load(html);
  $(website.selector, html).each(function () {
    const title = $(this).text().trim();
    const resUrl = $(this).attr('href');
    if (!title || !resUrl) return;
    let url = '';
    try {
      url = new URL(resUrl.trim(), website.address).href;
    } catch {
      return;
    }
    originalArticles.push({ title, url, source: website.name });
  });
  return originalArticles.filter((article) => article.title !== '');
}

const getData = async (website) => {
  try {
    const res = await axios.get(website.address, axiosFetchOpts);
    return extractFromWebsiteHtml(website, res.data);
  } catch (err) {
    return [];
  }
};

function countBySource(list) {
  const m = {};
  for (const a of list) {
    const s = a.source || '(none)';
    m[s] = (m[s] || 0) + 1;
  }
  return m;
}

async function diagnoseFeedSources() {
  const fetchDetails = [];

  for (const w of websites) {
    try {
      const res = await axios.get(w.address, axiosFetchOpts);
      const html = res.data;
      const htmlStr = typeof html === 'string' ? html : '';
      const $ = cheerio.load(html);
      const selectorMatches = w.selector ? $(w.selector).length : null;
      const extracted = extractFromWebsiteHtml(w, html);
      fetchDetails.push({
        kind: 'website',
        name: w.name,
        url: w.address,
        selector: w.selector || '(custom)',
        ok: true,
        httpStatus: res.status,
        htmlLength: htmlStr.length,
        selectorMatches,
        extractedCount: extracted.length,
        sample: extracted[0] || null,
      });
    } catch (e) {
      fetchDetails.push({
        kind: 'website',
        name: w.name,
        url: w.address,
        selector: w.selector || '(custom)',
        ok: false,
        error: String(e.message || e),
      });
    }
  }

  for (const feed of rssFeeds) {
    try {
      const res = await axios.get(feed.url, axiosFetchOpts);
      const xml = typeof res.data === 'string' ? res.data : '';
      const items = parseRssXml(xml, feed.source);
      fetchDetails.push({
        kind: 'rss',
        name: feed.source,
        url: feed.url,
        ok: true,
        httpStatus: res.status,
        xmlLength: xml.length,
        extractedCount: items.length,
        sample: items[0] || null,
      });
    } catch (e) {
      fetchDetails.push({
        kind: 'rss',
        name: feed.source,
        url: feed.url,
        ok: false,
        error: String(e.message || e),
      });
    }
  }

  const [classicChunks, rssChunks] = await Promise.all([
    Promise.all(websites.map((website) => getData(website))),
    Promise.all(rssFeeds.map((feed) => getRssFeed(feed))),
  ]);
  const merged = [];
  for (const data of classicChunks) merged.push(...data);
  for (const data of rssChunks) merged.push(...data);

  const gossipDropped = merged.filter((a) => GOSSIP_REGEX.test(`${a.title} ${a.url}`)).length;

  const afterFilter = filterHardNews(merged);
  const filteredOut = merged.filter((a) => !isHardNewsArticle(a));
  const filterRejectedBySource = countBySource(filteredOut);

  const afterDedupe = dedupeByUrl(afterFilter);

  const getArticlesResult = await getArticles();

  return {
    summary: {
      mergedRaw: merged.length,
      gossipDropped,
      afterHardNewsFilter: afterFilter.length,
      afterDedupe: afterDedupe.length,
      getArticlesCount: getArticlesResult.length,
      rawBySource: countBySource(merged),
      afterFilterBySource: countBySource(afterFilter),
      afterDedupeBySource: countBySource(afterDedupe),
      getArticlesBySource: countBySource(getArticlesResult),
      filterRejectedBySource,
    },
    fetchDetails,
  };
}

const getArticles = async () => {
  const [classicChunks, rssChunks] = await Promise.all([
    Promise.all(websites.map((website) => getData(website))),
    Promise.all(rssFeeds.map((feed) => getRssFeed(feed))),
  ]);
  const articles = [];
  for (const data of classicChunks) {
    articles.push(...data);
  }
  for (const data of rssChunks) {
    articles.push(...data);
  }
  let list = dedupeByUrl(filterHardNews(articles));
  shuffleArray(list);
  if (list.length > FEED_ARTICLE_MAX) {
    list = list.slice(0, FEED_ARTICLE_MAX);
  }
  if (list.length > 0) {
    list = await enrichArticlesFromWeb(list);
  }
  return list;
};

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

const cleanQueryParams = (params) => {
  const newParams = {};
  for (const [key, value] of Object.entries(params)) {
    newParams[key.toLowerCase()] = value;
  }
  return newParams;
};

const limitBlogs = (request, articles) => {
  const retArticles = [...articles];
  if (request.query && request.query.limit) {
    if (request.query.limit < 0) {
      request.query.limit = 0;
    }
    return retArticles.slice(0, request.query.limit);
  }
  return retArticles;
};

const filteredArticles = (request, articles) => {
  let cleanArticles = articles;
  if (Object.keys(request.query).length > 0) {
    const lowerCaseQuery = cleanQueryParams(request.query);
    let { source, team, player } = lowerCaseQuery;

    if (source) {
      cleanArticles = articles.filter(
        (article) => article.source.replace('_', '-') === source
      );
    }

    if (team) {
      cleanArticles = cleanArticles.filter(
        (article) => article.title.includes(team) || article.url.includes(team)
      );
    }

    if (player) {
      cleanArticles = cleanArticles.filter(
        (article) =>
          article.title.includes(player) || article.url.includes(player)
      );
    }
  }

  return cleanArticles;
};

module.exports = {
  shuffleArray,
  limitBlogs,
  getArticles,
  filteredArticles,
  diagnoseFeedSources,
};
