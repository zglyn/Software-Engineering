const express = require('express');
const cors = require('cors');
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