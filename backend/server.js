const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

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
        const teamsResult = await docClient.send(new ScanCommand({ TableName: 'Teams' }));
        const team = (teamsResult.Items ?? []).find(item => {
            const staff = item.team?.staff ?? {};
            return Object.values(staff).includes(coachId);
        });

        if (!team) return res.status(404).json({ error: 'No team found for this coach' });

        const teamId = team.team_id;

        const playersResult = await docClient.send(new ScanCommand({ TableName: 'Players' }));
        const players = (playersResult.Items ?? []).filter(p => p.team_id === teamId);

        res.status(200).json({ players, teamId });
    } catch (error) {
        console.error('Error fetching players by coach:', error);
        res.status(500).json({ error: 'Failed to fetch players' });
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