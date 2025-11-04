const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const FormData = require('form-data');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;
const upload = multer();

// In-memory storage for coding data (temporary solution)
// In production, consider using Redis or a database
const codingDataStore = new Map();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files (HTML, CSS, images)
app.use(express.static(__dirname));

// Serve interface.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'interface.html'));
});

// File upload proxy endpoint
app.post('/upload', upload.any(), async (req, res) => {
    try {
        const webhookUrl = req.body.webhookUrl || 'https://n8n-test.iohealth.com/webhook/4cac2e27-c4f9-4d2d-8260-44cc8bedb55f';
        
        console.log('Proxying file upload to:', webhookUrl);
        console.log('Files received:', req.files?.length || 0);

        const formData = new FormData();
        
        if (req.files) {
            req.files.forEach(file => {
                formData.append('file', file.buffer, {
                    filename: file.originalname,
                    contentType: file.mimetype
                });
            });
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });

        const result = await response.json().catch(() => ({}));
        
        console.log('n8n upload response status:', response.status);
        
        res.status(response.status).json(result);

    } catch (error) {
        console.error('Upload proxy error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Resume workflow proxy endpoint
app.post('/resume', async (req, res) => {
    try {
        const { resumeUrl, data } = req.body;
        
        if (!resumeUrl) {
            return res.status(400).json({ error: 'resumeUrl is required' });
        }

        console.log('Proxying request to:', resumeUrl);

        const response = await fetch(resumeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        const result = await response.json().catch(() => ({}));
        
        console.log('n8n response:', result);
        
        res.json({
            success: true,
            status: response.status,
            data: result
        });

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint for n8n to send coding data (second payload)
app.post('/coding', async (req, res) => {
    try {
        const { coding, sessionId } = req.body;
        
        console.log('📨 Received coding data from n8n');
        console.log('Session ID:', sessionId || 'default');
        console.log('Coding length:', coding?.length || 0);
        
        // Store the coding data with sessionId (or use 'latest' as default)
        const id = sessionId || 'latest';
        codingDataStore.set(id, {
            coding: coding,
            timestamp: Date.now()
        });
        
        // Clean up old entries (older than 5 minutes)
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        for (const [key, value] of codingDataStore.entries()) {
            if (value.timestamp < fiveMinutesAgo) {
                codingDataStore.delete(key);
            }
        }
        
        res.json({
            success: true,
            message: 'Coding data received and stored'
        });
        
    } catch (error) {
        console.error('Coding endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint for frontend to check if coding data is available
app.get('/coding/:sessionId?', (req, res) => {
    try {
        const sessionId = req.params.sessionId || 'latest';
        const codingData = codingDataStore.get(sessionId);
        
        if (codingData) {
            console.log('✓ Coding data found for session:', sessionId);
            // Delete after retrieval to prevent duplicate reads
            codingDataStore.delete(sessionId);
            
            res.json({
                success: true,
                coding: codingData.coding
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'No coding data available yet'
            });
        }
        
    } catch (error) {
        console.error('Coding retrieval error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'CORS proxy is running' });
});

app.listen(PORT, () => {
    console.log(`✓ CORS Proxy Server running on port ${PORT}`);
    console.log(`✓ Coding endpoint: POST http://localhost:${PORT}/coding`);
    console.log(`✓ Frontend can check: GET http://localhost:${PORT}/coding/:sessionId`);
});