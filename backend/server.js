const express = require('express');
const cors = require('cors');
require('dotenv').config(); 
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

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

// ---------------- API Routes
app.get('/api/teams', async (req, res) => {
    try {
        const command = new ScanCommand({ TableName: 'Team' });
        const response = await docClient.send(command);
        res.status(200).json(response.Items); 
    } catch (error) {
        console.error("Error fetching teams:", error);
        res.status(500).json({ error: "Failed to fetch teams" });
    }
});

// POST /api/teams
app.post('/api/teams', async (req, res) => {
    try {
        const newTeam = req.body;
        const command = new PutCommand({
            TableName: 'Team',
            Item: newTeam
        });
        await docClient.send(command);
        res.status(201).json({ message: "Team created successfully!", team: newTeam });
    } catch (error) {
        console.error("Error creating team:", error);
        res.status(500).json({ error: "Failed to create team" });
    }
});

// GET /api/players 
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

// POST /api/players 
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

// DELETE /api/players/:id 
app.delete('/api/players/:id', async (req, res) => {
    try {
        const playerId = req.params.id; // Grabs the ID from the URL
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Backend server is running on http://localhost:${PORT}`);
});