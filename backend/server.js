const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { fetchTeamGamelogRecent, fetchCommonPlayerInfo } = require('./services/nba-stats/nbaStatsClient');
const { runNbaFeedSync, FEED_GAMES_META_ARTICLE_ID } = require('./services/nba-feed/feedSync');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});
const docClient = DynamoDBDocumentClient.from(client);

const FEED_TABLE = process.env.FEED_TABLE || 'feed';
const NBA_FEED_POLL_MS = Number(process.env.NBA_FEED_POLL_MS || process.env.NBA_FEED_REFRESH_MS || process.env.NBA_ARTICLES_REFRESH_MS || 3 * 60 * 60 * 1000);
const NOTES_TABLE = process.env.NOTES_TABLE || 'Notes';

let PLAYER_RANK_SEED_BY_TEAM = null;
try {
    PLAYER_RANK_SEED_BY_TEAM = require('./seed/player_ranks_by_team.json');
} catch (_) {}

function unwrapDynamoNumberAttr(v) {
    if (v == null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
    if (typeof v === 'object' && v !== null && typeof v.N === 'string' && Number.isFinite(Number(v.N))) return Number(v.N);
    return null;
}

function pickPlayerRankMapFromTeamRecord(teamItem) {
    const nested = teamItem?.team;
    const raw = nested?.player_ranks ?? teamItem?.player_ranks;
    if (!raw || typeof raw !== 'object') return new Map();
    const out = new Map();
    const assignEntry = (k, v) => {
        const n = unwrapDynamoNumberAttr(v);
        if (n != null) out.set(String(k), n);
    };
    if (raw.M && typeof raw.M === 'object') {
        for (const [k, v] of Object.entries(raw.M)) assignEntry(k, v);
        return out;
    }
    for (const [k, v] of Object.entries(raw)) {
        if (k === 'M' || k === 'L') continue;
        assignEntry(k, v);
    }
    return out;
}

async function resolveTeamForCoach(coachId) {
    const cid = String(coachId ?? '').trim();
    if (!cid) return null;
    const teamsResult = await docClient.send(new ScanCommand({ TableName: 'Teams' }));
    const team = (teamsResult.Items ?? []).find((item) => {
        const staff = item.team?.staff ?? {};
        return Object.values(staff).some((v) => String(v) === cid);
    });
    if (!team) return null;
    const teamId = team.team_id;
    let teamFull = team;
    try {
        const got = await docClient.send(
            new GetCommand({
                TableName: 'Teams',
                Key: { team_id: team.team_id },
            })
        );
        if (got.Item) teamFull = got.Item;
    } catch (_) {}
    return { teamFull, teamId };
}

async function loadValidUserIdSet() {
    const usersResult = await docClient.send(new ScanCommand({ TableName: 'Users' }));
    return new Set(
        (usersResult.Items ?? [])
            .map((u) => String(u.userId ?? u.id ?? '').trim())
            .filter(Boolean)
    );
}

function todayEtYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function getLatestStoredGameDateYmd() {
  try {
    const got = await docClient.send(
      new GetCommand({
        TableName: FEED_TABLE,
        Key: { article_id: FEED_GAMES_META_ARTICLE_ID },
      })
    );
    const y = got.Item && got.Item.latest_game_date_ymd;
    if (typeof y === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(y)) return y;
  } catch (_) {}
  let maxYmd = null;
  let eks;
  do {
    const resp = await docClient.send(
      new ScanCommand({
        TableName: FEED_TABLE,
        ExclusiveStartKey: eks,
        ProjectionExpression: 'recent_games',
        FilterExpression: 'attribute_exists(recent_games)',
      })
    );
    for (const it of resp.Items || []) {
      for (const g of it.recent_games || []) {
        const d = g && g.game_date;
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
          if (maxYmd == null || d > maxYmd) maxYmd = d;
        }
      }
    }
    eks = resp.LastEvaluatedKey;
  } while (eks);
  return maxYmd;
}

async function maybeRunNbaFeed() {
  try {
    const today = todayEtYmd();
    const latest = await getLatestStoredGameDateYmd();
    if (latest != null && latest >= today) {
      return;
    }
    await runNbaFeedSync(docClient, { tableName: FEED_TABLE });
    console.log('nba feed written to dynamodb', FEED_TABLE);
  } catch (e) {
    console.error('nba feed dynamo sync failed', String(e));
  }
}

void maybeRunNbaFeed();
setInterval(() => {
  void maybeRunNbaFeed();
}, NBA_FEED_POLL_MS);

app.get('/api/feed', async (req, res) => {
    try {
        let all = [];
        let eks;
        do {
            const resp = await docClient.send(new ScanCommand({
                TableName: FEED_TABLE,
                ExclusiveStartKey: eks,
            }));
            all = all.concat(resp.Items || []);
            eks = resp.LastEvaluatedKey;
        } while (eks);

        const gameRows = (all || []).filter((it) => Array.isArray(it.recent_games) && it.recent_games.length > 0);
        const articleRows = (all || []).filter((it) => it.title && it.url && !Array.isArray(it.recent_games));

        const forYouGames = [];
        for (const row of gameRows) {
            const ua = row.updated_at || '';
            for (const g of row.recent_games) {
                forYouGames.push({ kind: 'game', updated_at: ua, game: g });
            }
        }

        const articles = articleRows.map((a) => ({
            kind: 'article',
            updated_at: a.updated_at || '',
            article_id: a.article_id,
            title: a.title,
            url: a.url,
            source: a.source,
            thumbnail_url: a.thumbnail_url,
        }));

        const forYou = [...forYouGames, ...articles].sort((a, b) =>
            String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
        );

        res.status(200).json({ forYou });
    } catch (err) {
        console.error('Error fetching feed:', err);
        res.status(500).json({ error: 'Failed to fetch feed' });
    }
});

const VIDEOS_TABLE = process.env.VIDEOS_TABLE || 'videos';
const STATS_WORKER_CONCURRENCY = Number(process.env.STATS_WORKER_CONCURRENCY || 1);
const STATS_WORKER_TIMEOUT_MS = Number(process.env.STATS_WORKER_TIMEOUT_MS || 10 * 60 * 1000);
const STATS_PYTHON = process.env.STATS_PYTHON || 'python3';
const STATS_SCRIPT = process.env.STATS_SCRIPT || path.join(__dirname, '..', 'cv', 'inference_stats.py');
const statsQueue = [];
let statsRunning = 0;

function slugStemFromObjectFileName(fileName) {
    const base = String(fileName).split(/[/\\]/).pop() || '';
    const sep = base.indexOf('__');
    const core = sep >= 0 ? base.slice(sep + 2) : base;
    const dot = core.lastIndexOf('.');
    return dot === -1 ? core : core.slice(0, dot);
}

function buildVideoRowId(userId, objectFileName) {
    const uid = String(userId).trim();
    const stem = slugStemFromObjectFileName(objectFileName);
    const maxV = Math.max(0, 255 - uid.length - 1);
    let videoname = stem.slice(0, maxV || 1);
    if (!videoname) videoname = 'v';
    return `${uid}_${videoname}`.slice(0, 255);
}

async function downloadSupabaseObjectToFile({ bucket, objectPath, destPath }) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error || !data) throw (error || new Error('download failed'));
    const buf = Buffer.from(await data.arrayBuffer());
    await fs.promises.writeFile(destPath, buf);
}

function runPythonInference({ videoPath }) {
    return new Promise((resolve, reject) => {
        const proc = spawn(STATS_PYTHON, [STATS_SCRIPT, '--video', videoPath], { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const killTimer = setTimeout(() => {
            try { proc.kill('SIGKILL'); } catch {}
        }, STATS_WORKER_TIMEOUT_MS);
        proc.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
        proc.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
        proc.on('error', (e) => {
            clearTimeout(killTimer);
            reject(e);
        });
        proc.on('close', (code) => {
            clearTimeout(killTimer);
            if (code !== 0) {
                reject(new Error(`python failed: ${code} ${stderr}`));
                return;
            }
            try {
                resolve(JSON.parse(stdout.trim()));
            } catch {
                reject(new Error(`bad json ${stderr}`));
            }
        });
    });
}

async function updateVideoStats({ video_id, stats }) {
    await docClient.send(new UpdateCommand({
        TableName: VIDEOS_TABLE,
        Key: { video_id },
        UpdateExpression: 'SET statsGenerated=:sg, ft_0=:ft0, ft_1=:ft1, p2_0=:p20, p2_1=:p21, p3_0=:p30, p3_1=:p31, total_points=:tp',
        ExpressionAttributeValues: {
            ':sg': true,
            ':ft0': Number(stats.ft_0) || 0,
            ':ft1': Number(stats.ft_1) || 0,
            ':p20': Number(stats.p2_0) || 0,
            ':p21': Number(stats.p2_1) || 0,
            ':p30': Number(stats.p3_0) || 0,
            ':p31': Number(stats.p3_1) || 0,
            ':tp': Number(stats.total_points) || 0,
        },
    }));
}

function enqueueStatsJob(job) {
    statsQueue.push(job);
    void drainStatsQueue();
}

async function drainStatsQueue() {
    while (statsRunning < STATS_WORKER_CONCURRENCY && statsQueue.length > 0) {
        const job = statsQueue.shift();
        statsRunning += 1;
        (async () => {
            const tmp = path.join(os.tmpdir(), `${job.video_id}.mp4`);
            try {
                await downloadSupabaseObjectToFile({ bucket: job.bucket, objectPath: job.object_path, destPath: tmp });
                const result = await runPythonInference({ videoPath: tmp });
                const stats = result?.stats;
                if (!stats) throw new Error('missing stats');
                console.log('stats generated', { video_id: job.video_id, stats });
                await updateVideoStats({ video_id: job.video_id, stats });
            } catch (e) {
                console.error('stats job failed', { video_id: job.video_id, error: String(e) });
            } finally {
                fs.unlink(tmp, () => {});
                statsRunning -= 1;
                void drainStatsQueue();
            }
        })();
    }
}

function storageUserSegment(userId) {
    return String(userId).trim().replace(/[^a-zA-Z0-9._-]/g, '_');
}

function storageObjectBaseName(originalname) {
    const base = String(originalname || 'video').split(/[/\\]/).pop() || 'video';
    return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function displayTitleFromStorageFileName(fileName) {
    const base = String(fileName).split(/[/\\]/).pop() || '';
    const sep = base.indexOf('__');
    const core = sep >= 0 ? base.slice(sep + 2) : base;
    const dot = core.lastIndexOf('.');
    return dot === -1 ? core : core.slice(0, dot);
}

function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

const videoUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${storageObjectBaseName(file.originalname)}`),
    }),
    limits: { fileSize: 512 * 1024 * 1024 },
});

const parseVideoUpload = (req, res, next) => {
    videoUpload.single('video')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                res.status(413).json({ error: 'file too large' });
                return;
            }
            res.status(400).json({ error: 'upload failed' });
            return;
        }
        next();
    });
};

app.post('/api/upload-videos', parseVideoUpload, async (req, res) => {
    const file = req.file;
    const tmpPath = file?.path;
    const cleanup = () => {
        if (tmpPath) fs.unlink(tmpPath, () => {});
    };
    try {
        const userId = req.body?.userId;
        if (userId == null || typeof userId !== 'string' || !userId.trim()) {
            cleanup();
            res.status(400).json({ error: 'userId required' });
            return;
        }
        if (!file?.path) {
            res.status(400).json({ error: 'video file required' });
            return;
        }
        const uidSeg = storageUserSegment(userId);
        if (!uidSeg) {
            cleanup();
            res.status(400).json({ error: 'userId required' });
            return;
        }
        if (!String(file.mimetype || '').startsWith('video/')) {
            cleanup();
            res.status(400).json({ error: 'video file required' });
            return;
        }
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            cleanup();
            res.status(503).json({ error: 'Supabase not configured' });
            return;
        }
        const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'swe-videos';
        const uid = String(userId).trim();
        const maxVideonameLen = Math.max(0, 255 - uid.length - 1);
        const origName = file.originalname || 'video';
        const lastDot = origName.lastIndexOf('.');
        const ext = lastDot >= 0 ? origName.slice(lastDot) : '';
        const origBase = lastDot >= 0 ? origName.slice(0, lastDot) : origName;
        const titleMax = Math.max(0, 255 - uid.length);
        const titleField = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, titleMax) : '';
        const slugSource = titleField || origBase;
        let slug = storageObjectBaseName(slugSource);
        if (!slug) slug = storageObjectBaseName(origBase) || 'video';
        slug = slug.slice(0, maxVideonameLen || 1);
        const objectPath = `${uidSeg}/${Date.now()}__${slug}${ext}`;
        const objectFileName = objectPath.split('/').pop() || '';
        const video_id = buildVideoRowId(userId, objectFileName);
        const stream = fs.createReadStream(file.path);
        const { error } = await supabase.storage.from(bucket).upload(objectPath, stream, {
            contentType: file.mimetype || 'application/octet-stream',
            upsert: false,
        });
        cleanup();
        if (error) {
            console.error('Supabase upload-videos:', error);
            res.status(500).json({ error: 'Storage upload failed' });
            return;
        }
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath);
        const videoId = Buffer.from(objectPath, 'utf8').toString('base64url');
        const videoRow = {
            video_id,
            userId: uid,
            object_path: objectPath,
            statsGenerated: false,
            ft_0: 0,
            ft_1: 0,
            p2_0: 0,
            p2_1: 0,
            p3_0: 0,
            p3_1: 0,
            total_points: 0,
        };
        try {
            await docClient.send(new PutCommand({
                TableName: VIDEOS_TABLE,
                Item: videoRow,
            }));
        } catch (dbErr) {
            console.error('videos Put:', dbErr);
            res.status(500).json({ error: 'Recording video failed' });
            return;
        }
        enqueueStatsJob({ video_id, object_path: objectPath, bucket, user_id: uid });
        res.status(200).json({
            bucket,
            path: objectPath,
            publicUrl: pub?.publicUrl ?? null,
            videoId,
            video_id,
        });
    } catch (error) {
        cleanup();
        console.error('upload-videos:', error);
        res.status(500).json({ error: 'Storage upload failed' });
    }
});

app.get('/api/uploads/videos', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (userId == null || typeof userId !== 'string' || !String(userId).trim()) {
            res.status(400).json({ error: 'userId required' });
            return;
        }
        const uidSeg = storageUserSegment(userId);
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            res.status(503).json({ error: 'Supabase not configured' });
            return;
        }
        const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'swe-videos';
        const { data: entries, error } = await supabase.storage.from(bucket).list(uidSeg, {
            limit: 200,
            sortBy: { column: 'created_at', order: 'desc' },
        });
        if (error) {
            console.error('list uploads:', error);
            res.status(500).json({ error: 'list failed' });
            return;
        }
        const rows = [];
        for (const e of entries || []) {
            if (!e?.name) continue;
            if (!e.metadata || Number(e.metadata.size) <= 0) continue;
            const fullPath = `${uidSeg}/${e.name}`;
            const { data: signed, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(fullPath, 3600);
            if (signErr || !signed?.signedUrl) continue;
            let statsGenerated = false;
            try {
                const vid = buildVideoRowId(userId, e.name);
                const { Item } = await docClient.send(new GetCommand({
                    TableName: VIDEOS_TABLE,
                    Key: { video_id: vid },
                }));
                if (Item) statsGenerated = !!Item.statsGenerated;
            } catch (ge) {
                console.error('videos Get:', ge);
            }
            rows.push({
                path: fullPath,
                name: e.name,
                title: displayTitleFromStorageFileName(e.name),
                createdAt: e.created_at ?? e.updated_at ?? null,
                signedUrl: signed.signedUrl,
                statsGenerated,
            });
        }
        res.status(200).json({ items: rows });
    } catch (err) {
        console.error('uploads/videos:', err);
        res.status(500).json({ error: 'list failed' });
    }
});

app.get('/api/uploads/video-url', async (req, res) => {
    try {
        const userId = req.query.userId;
        let objectPath = req.query.path;
        if (typeof objectPath !== 'string') objectPath = '';
        try {
            objectPath = decodeURIComponent(objectPath);
        } catch {
            objectPath = '';
        }
        if (userId == null || typeof userId !== 'string' || !String(userId).trim()) {
            res.status(400).json({ error: 'userId required' });
            return;
        }
        if (!objectPath || objectPath.includes('..') || objectPath.startsWith('/')) {
            res.status(400).json({ error: 'path required' });
            return;
        }
        const uidSeg = storageUserSegment(userId);
        if (!objectPath.startsWith(`${uidSeg}/`)) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            res.status(503).json({ error: 'Supabase not configured' });
            return;
        }
        const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'swe-videos';
        const namePart = objectPath.slice(uidSeg.length + 1);
        const { data: signed, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 3600);
        if (error || !signed?.signedUrl) {
            res.status(404).json({ error: 'not found' });
            return;
        }
        res.status(200).json({ signedUrl: signed.signedUrl, name: displayTitleFromStorageFileName(namePart) });
    } catch (err) {
        console.error('uploads/video-url:', err);
        res.status(500).json({ error: 'failed' });
    }
});

app.get('/api/videos/by-object-path', async (req, res) => {
    try {
        const userId = req.query.userId;
        let objectPath = req.query.path;
        if (typeof objectPath !== 'string') objectPath = '';
        try {
            objectPath = decodeURIComponent(objectPath);
        } catch {
            objectPath = '';
        }
        if (userId == null || typeof userId !== 'string' || !String(userId).trim()) {
            res.status(400).json({ error: 'userId required' });
            return;
        }
        if (!objectPath || objectPath.includes('..') || objectPath.startsWith('/')) {
            res.status(400).json({ error: 'path required' });
            return;
        }
        const uidSeg = storageUserSegment(userId);
        if (!objectPath.startsWith(`${uidSeg}/`)) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        const fileName = objectPath.split('/').pop() || '';
        const video_id = buildVideoRowId(userId, fileName);
        const { Item } = await docClient.send(new GetCommand({
            TableName: VIDEOS_TABLE,
            Key: { video_id },
        }));
        if (!Item || Item.userId !== String(userId).trim()) {
            res.status(200).json({
                video_id,
                statsGenerated: false,
                ft_0: 0,
                ft_1: 0,
                p2_0: 0,
                p2_1: 0,
                p3_0: 0,
                p3_1: 0,
                total_points: 0,
                missing: true,
            });
            return;
        }
        res.status(200).json({
            video_id,
            statsGenerated: !!Item.statsGenerated,
            ft_0: Number(Item.ft_0) || 0,
            ft_1: Number(Item.ft_1) || 0,
            p2_0: Number(Item.p2_0) || 0,
            p2_1: Number(Item.p2_1) || 0,
            p3_0: Number(Item.p3_0) || 0,
            p3_1: Number(Item.p3_1) || 0,
            total_points: Number(Item.total_points) || 0,
            missing: false,
        });
    } catch (err) {
        console.error('videos/by-object-path:', err);
        res.status(500).json({ error: 'failed' });
    }
});

app.delete('/api/uploads/video', async (req, res) => {
    try {
        const userId = req.query.userId;
        let objectPath = req.query.path;
        if (typeof objectPath !== 'string') objectPath = '';
        try {
            objectPath = decodeURIComponent(objectPath);
        } catch {
            objectPath = '';
        }
        if (userId == null || typeof userId !== 'string' || !String(userId).trim()) {
            res.status(400).json({ error: 'userId required' });
            return;
        }
        if (!objectPath || objectPath.includes('..') || objectPath.startsWith('/')) {
            res.status(400).json({ error: 'path required' });
            return;
        }
        const uid = String(userId).trim();
        const uidSeg = storageUserSegment(uid);
        if (!objectPath.startsWith(`${uidSeg}/`)) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            res.status(503).json({ error: 'Supabase not configured' });
            return;
        }
        const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'swe-videos';
        const fileName = objectPath.split('/').pop() || '';
        const video_id = buildVideoRowId(uid, fileName);
        const { error: storageErr } = await supabase.storage.from(bucket).remove([objectPath]);
        if (storageErr) {
            console.error('delete storage:', storageErr);
            res.status(500).json({ error: 'delete failed' });
            return;
        }
        try {
            await docClient.send(new DeleteCommand({
                TableName: VIDEOS_TABLE,
                Key: { video_id },
            }));
        } catch (dbErr) {
            console.error('delete dynamo:', dbErr);
        }
        res.status(200).json({ ok: true });
    } catch (err) {
        console.error('uploads/video delete:', err);
        res.status(500).json({ error: 'delete failed' });
    }
});

app.get('/api/teams', async (req, res) => {
    try {
        const command = new ScanCommand({ TableName: 'Teams' });
        const response = await docClient.send(command);
        res.status(200).json(response.Items);
    } catch (error) {
        console.error("Error fetching teams:", error);
        res.status(500).json({ error: "Failed to fetch teams" });
    }
});

app.get('/api/teams/:teamId', async (req, res) => {
    try {
        const command = new GetCommand({
            TableName: 'Teams',
            Key: { team_id: req.params.teamId }
        });
        const response = await docClient.send(command);
        if (!response.Item) {
            return res.status(404).json({ error: 'Team not found' });
        }
        res.status(200).json(response.Item);
    } catch (error) {
        console.error("Error fetching team:", error);
        res.status(500).json({ error: "Failed to fetch team" });
    }
});

app.get('/api/players/by-coach', async (req, res) => {
    const { coachId } = req.query;
    if (!coachId) return res.status(400).json({ error: 'coachId required' });

    try {
        const resolved = await resolveTeamForCoach(String(coachId));
        if (!resolved) return res.status(404).json({ error: 'No team found for this coach' });
        const { teamFull, teamId } = resolved;

        let rankMap = pickPlayerRankMapFromTeamRecord(teamFull);
        if (rankMap.size === 0 && PLAYER_RANK_SEED_BY_TEAM && typeof PLAYER_RANK_SEED_BY_TEAM === 'object') {
            const seed = PLAYER_RANK_SEED_BY_TEAM[String(teamId)];
            if (seed && typeof seed === 'object') {
                rankMap = new Map(
                    Object.entries(seed)
                        .map(([k, v]) => [String(k), Number(v)])
                        .filter(([, n]) => Number.isFinite(n))
                );
            }
        }

        const validUserIds = await loadValidUserIdSet();
        const playersResult = await docClient.send(new ScanCommand({ TableName: 'Players' }));
        const players = (playersResult.Items ?? [])
            .filter((p) => String(p.team_id) === String(teamId))
            .filter((p) => {
                const uid = String(p.user_id ?? '').trim();
                return uid !== '' && validUserIds.has(uid);
            })
            .map((p) => {
                const pid = p.player_id ?? p.id;
                const fromMap = pid != null ? rankMap.get(String(pid)) : undefined;
                const fromPlayer = unwrapDynamoNumberAttr(p.overall_rank);
                const overall_rank = fromMap != null ? fromMap : fromPlayer;
                if (overall_rank == null) return p;
                return { ...p, overall_rank };
            });

        res.status(200).json({ players, teamId });
    } catch (error) {
        console.error('Error fetching players by coach:', error);
        res.status(500).json({ error: 'Failed to fetch players' });
    }
});

app.get('/api/coach/player-assign/options', async (req, res) => {
    const coachId = String(req.query.coachId ?? '').trim();
    if (!coachId) return res.status(400).json({ error: 'coachId required' });
    try {
        const resolved = await resolveTeamForCoach(coachId);
        if (!resolved) return res.status(404).json({ error: 'No team found for this coach' });
        const { teamId } = resolved;
        const usersResult = await docClient.send(new ScanCommand({ TableName: 'Users' }));
        const validUserIds = new Set(
            (usersResult.Items ?? [])
                .map((u) => String(u.userId ?? u.id ?? '').trim())
                .filter(Boolean)
        );
        const eligibleUsers = (usersResult.Items ?? [])
            .filter((u) => {
                const pid = u.player_id ?? u.playerId;
                if (pid != null && String(pid).trim() !== '') return false;
                const uid = String(u.userId ?? u.id ?? '').trim();
                return !!uid;
            })
            .map((u) => ({
                userId: String(u.userId ?? u.id),
                name:
                    String(u.name ?? u.displayName ?? u.email ?? u.userId ?? u.id ?? '').trim() ||
                    String(u.userId ?? u.id),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
        const playersResult = await docClient.send(new ScanCommand({ TableName: 'Players' }));
        const openSlots = (playersResult.Items ?? [])
            .filter((p) => String(p.team_id) === String(teamId))
            .filter((p) => {
                const uid = String(p.user_id ?? '').trim();
                return !uid || !validUserIds.has(uid);
            })
            .map((p) => ({
                player_id: p.player_id ?? p.id,
                name: String(p.name ?? 'Player'),
                position: p.position != null ? String(p.position) : undefined,
            }))
            .filter((x) => x.player_id != null && String(x.player_id).trim() !== '')
            .sort((a, b) => String(a.name).localeCompare(String(b.name)));
        return res.status(200).json({ ok: true, eligibleUsers, openSlots, teamId });
    } catch (e) {
        console.error('player-assign/options failed', String(e));
        return res.status(500).json({ error: 'Failed to load options' });
    }
});

app.post('/api/coach/player-assign', async (req, res) => {
    const coachId = String(req.body?.coachId ?? '').trim();
    const userId = String(req.body?.userId ?? '').trim();
    const rosterPlayerId = String(req.body?.rosterPlayerId ?? '').trim();
    if (!coachId || !userId || !rosterPlayerId) {
        return res.status(400).json({ error: 'coachId, userId, rosterPlayerId required' });
    }
    try {
        const resolved = await resolveTeamForCoach(coachId);
        if (!resolved) return res.status(404).json({ error: 'No team found for this coach' });
        const { teamId } = resolved;
        const validUserIds = await loadValidUserIdSet();
        const usersResult = await docClient.send(new ScanCommand({ TableName: 'Users' }));
        const userRow = (usersResult.Items ?? []).find((u) => String(u.userId ?? u.id ?? '') === userId);
        if (!userRow) return res.status(404).json({ error: 'User not found' });
        const existingPid = userRow.player_id ?? userRow.playerId;
        if (existingPid != null && String(existingPid).trim() !== '') {
            return res.status(400).json({ error: 'User already linked to a player' });
        }
        const playersResult = await docClient.send(new ScanCommand({ TableName: 'Players' }));
        const playerRow = (playersResult.Items ?? []).find(
            (p) =>
                String(p.team_id) === String(teamId) &&
                String(p.player_id ?? p.id ?? '') === String(rosterPlayerId)
        );
        if (!playerRow) return res.status(404).json({ error: 'Roster player not on your team' });
        const uidOnPlayer = String(playerRow.user_id ?? '').trim();
        if (uidOnPlayer && validUserIds.has(uidOnPlayer)) {
            return res.status(400).json({ error: 'Roster slot already assigned' });
        }
        const pk = playerRow.player_id ?? playerRow.id;
        if (pk == null || String(pk).trim() === '') {
            return res.status(400).json({ error: 'Invalid roster record' });
        }
        const linkPid =
            typeof pk === 'number' ? pk : Number.isFinite(Number(pk)) ? Number(pk) : String(pk);
        await docClient.send(
            new UpdateCommand({
                TableName: 'Players',
                Key: { player_id: pk },
                UpdateExpression: 'SET user_id = :uid',
                ExpressionAttributeValues: { ':uid': userId },
            })
        );
        await docClient.send(
            new UpdateCommand({
                TableName: 'Users',
                Key: { userId },
                UpdateExpression: 'SET player_id = :pid',
                ExpressionAttributeValues: { ':pid': linkPid },
            })
        );
        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error('player-assign failed', String(e));
        return res.status(500).json({ error: 'Failed to assign player' });
    }
});

app.get('/api/player/:playerId', async (req, res) => {
    const want = String(req.params.playerId || '').trim();
    if (!want) return res.status(400).json({ error: 'playerId required' });
    try {
        const response = await docClient.send(new ScanCommand({ TableName: 'Players' }));
        const items = response.Items || [];
        const p = items.find(
            (x) =>
                String(x.player_id ?? '') === want ||
                String(x.id ?? '') === want
        );
        if (!p) return res.status(404).json({ error: 'Player not found' });
        const nbaPid = Number(p.player_id ?? want);
        let out = { ...p };
        if (Number.isFinite(nbaPid) && nbaPid > 0) {
            try {
                const nba_api = await fetchCommonPlayerInfo(nbaPid);
                if (nba_api) out = { ...out, nba_api };
            } catch (e) {
                console.warn('commonplayerinfo failed', String(nbaPid), String(e && e.message ? e.message : e));
            }
        }
        res.status(200).json(out);
    } catch (error) {
        console.error('Error fetching player:', error);
        res.status(500).json({ error: 'Failed to fetch player' });
    }
});

app.get('/api/players', async (req, res) => {
    try {
        const command = new ScanCommand({ TableName: 'Players' });
        const response = await docClient.send(command);
        res.status(200).json(response.Items);
    } catch (error) {
        console.error("Error fetching players:", error);
        res.status(500).json({ error: "Failed to fetch players" });
    }
});

app.get('/api/team-gamelog', async (req, res) => {
    const { teamId, limit, season, seasonType } = req.query;
    if (!teamId) return res.status(400).json({ error: 'teamId required' });
    try {
        const games = await fetchTeamGamelogRecent(teamId, { limit, season, seasonType });
        res.status(200).json({ games });
    } catch (e) {
        console.error('team-gamelog error:', e);
        res.status(500).json({ error: 'Failed to fetch team gamelog' });
    }
});


app.post('/api/players', async (req, res) => {
    try {
        const newPlayer = req.body;
        const command = new PutCommand({
            TableName: 'Players',
            Item: newPlayer
        });
        await docClient.send(command);
        res.status(201).json({ message: "Player added successfully!", player: newPlayer });
    } catch (error) {
        console.error("Error adding player:", error);
        res.status(500).json({ error: "Failed to add player" });
    }
});


app.delete('/api/players/:id', async (req, res) => {
    try {
        const playerId = req.params.id;
        const command = new DeleteCommand({
            TableName: 'Players',
            Key: { id: playerId }
        });
        await docClient.send(command);
        res.status(200).json({ message: `Player ${playerId} deleted successfully.` });
    } catch (error) {
        console.error("Error deleting player:", error);
        res.status(500).json({ error: "Failed to delete player" });
    }
});

app.get('/api/coaches', async (req, res) => {
    const { adminId } = req.query;
    if (!adminId) return res.status(400).json({ error: 'adminId query param required' });

    try {
        const userResult = await docClient.send(new GetCommand({
            TableName: 'Users',
            Key: { userId: adminId }
        }));
        const teamId = Number(userResult.Item?.admin_team_id);
        if (!teamId) return res.status(404).json({ error: 'No team assigned to this admin' });

        const teamResult = await docClient.send(new GetCommand({
            TableName: 'Teams',
            Key: { team_id: teamId }
        }));
        if (!teamResult.Item) return res.status(404).json({ error: 'Team not found' });

        const staff = teamResult.Item.team?.staff ?? {};
        res.status(200).json(staff);
    } catch (error) {
        console.error("Error fetching coaches:", error);
        res.status(500).json({ error: "Failed to fetch coaches" });
    }
});

app.post('/api/coaches', async (req, res) => {
    const { adminId, role, userId } = req.body;
    if (!adminId || !role || !userId) return res.status(400).json({ error: 'adminId, role and userId required' });

    try {
        const userResult = await docClient.send(new GetCommand({
            TableName: 'Users',
            Key: { userId: adminId }
        }));
        const teamId = Number(userResult.Item?.admin_team_id);
        if (!teamId) return res.status(404).json({ error: 'No team assigned to this admin' });

        const teamResult = await docClient.send(new GetCommand({
            TableName: 'Teams',
            Key: { team_id: teamId }
        }));
        if (!teamResult.Item) return res.status(404).json({ error: 'Team not found' });

        const teamData = teamResult.Item.team ?? {};
        const staff = typeof teamData.staff === 'object' && teamData.staff !== null
            ? teamData.staff
            : {};
        staff[role] = userId;
        teamData.staff = staff;

        await docClient.send(new UpdateCommand({
            TableName: 'Teams',
            Key: { team_id: teamId },
            UpdateExpression: 'SET #team = :team',
            ExpressionAttributeNames: { '#team': 'team' },
            ExpressionAttributeValues: { ':team': teamData },
        }));

        res.status(200).json({ message: 'Coach added successfully' });
    } catch (error) {
        console.error("Error adding coach:", error);
        res.status(500).json({ error: "Failed to add coach" });
    }
});

app.delete('/api/coaches', async (req, res) => {
    const { adminId, role } = req.query;
    if (!adminId || !role) return res.status(400).json({ error: 'adminId and role query params required' });

    try {
        const userResult = await docClient.send(new GetCommand({
            TableName: 'Users',
            Key: { userId: adminId }
        }));
        const teamId = Number(userResult.Item?.admin_team_id);
        if (!teamId) return res.status(404).json({ error: 'No team assigned to this admin' });

        const teamResult = await docClient.send(new GetCommand({
            TableName: 'Teams',
            Key: { team_id: teamId }
        }));
        if (!teamResult.Item) return res.status(404).json({ error: 'Team not found' });

        const teamData = teamResult.Item.team ?? {};
        const staff = typeof teamData.staff === 'object' && teamData.staff !== null
            ? { ...teamData.staff }
            : {};
        delete staff[role];
        teamData.staff = staff;

        await docClient.send(new UpdateCommand({
            TableName: 'Teams',
            Key: { team_id: teamId },
            UpdateExpression: 'SET #team = :team',
            ExpressionAttributeNames: { '#team': 'team' },
            ExpressionAttributeValues: { ':team': teamData },
        }));

        res.status(200).json({ message: 'Coach removed successfully' });
    } catch (error) {
        console.error("Error removing coach:", error);
        res.status(500).json({ error: "Failed to remove coach" });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const command = new ScanCommand({ TableName: 'Users' });
        const response = await docClient.send(command);
        res.status(200).json(response.Items);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

app.post('/api/notes/create', async (req, res) => {
  try {
    const sender_id = String(req.body?.sender_id || '').trim();
    const sender_name = String(req.body?.sender_name || '').trim();
    const recipient_id = String(req.body?.recipient_id || '').trim();
    const note_content = String(req.body?.note_content || '').trim();
    if (!sender_id || !recipient_id || !note_content) {
      return res.status(400).json({ error: 'sender_id, recipient_id, note_content required' });
    }
    const note_id = crypto.randomUUID();
    const date_created = new Date().toISOString();
    await docClient.send(
      new PutCommand({
        TableName: NOTES_TABLE,
        Item: {
          notes_id: note_id,
          note_id,
          sender_id,
          sender_name: sender_name || sender_id,
          recipient_id,
          note_content,
          date_created,
        },
      })
    );
    return res.status(200).json({ ok: true, note_id, date_created });
  } catch (e) {
    console.error('notes/create failed', String(e));
    return res.status(500).json({ error: 'Failed to create note' });
  }
});

app.get('/api/notes/by-recipient', async (req, res) => {
  try {
    const recipientId = String(req.query?.recipientId || '').trim();
    if (!recipientId) return res.status(400).json({ error: 'recipientId required' });
    const scanned = await docClient.send(
      new ScanCommand({
        TableName: NOTES_TABLE,
        FilterExpression: 'recipient_id = :rid',
        ExpressionAttributeValues: { ':rid': recipientId },
      })
    );
    const notes = (scanned.Items || []).sort((a, b) =>
      String(b.date_created || '').localeCompare(String(a.date_created || ''))
    );
    return res.status(200).json({ ok: true, notes });
  } catch (e) {
    console.error('notes/by-recipient failed', String(e));
    return res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

app.post('/api/notes/delete', async (req, res) => {
  try {
    const note_id = String(req.body?.note_id || req.body?.notes_id || '').trim();
    if (!note_id) return res.status(400).json({ error: 'note_id required' });
    await docClient.send(
      new DeleteCommand({
        TableName: NOTES_TABLE,
        Key: { notes_id: note_id },
      })
    );
    return res.status(200).json({ ok: true, note_id });
  } catch (e) {
    console.error('notes/delete failed', String(e));
    return res.status(500).json({ error: 'Failed to delete note' });
  }
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`✅ Backend server is running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
    } else {
        console.error('❌ Server error:', err);
    }
    process.exit(1);
});