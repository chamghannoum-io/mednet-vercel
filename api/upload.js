import formidable from 'formidable';
import FormData from 'form-data';
import fetch from 'node-fetch';

export const config = {
    api: {
        bodyParser: false, // Disable body parsing, we'll handle it ourselves
    },
};

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse multipart form data
        const form = formidable({ multiples: true });
        
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve([fields, files]);
            });
        });

        const webhookUrl = fields.webhookUrl || 'https://n8n-test.iohealth.com/webhook/4cac2e27-c4f9-4d2d-8260-44cc8bedb55f';
        
        console.log('Proxying file upload to:', webhookUrl);
        console.log('Files received:', Object.keys(files).length);

        // Create new FormData for forwarding
        const formData = new FormData();
        
        // Handle both single and multiple files
        const fileList = Array.isArray(files.file) ? files.file : [files.file];
        
        for (const file of fileList) {
            if (file) {
                const fs = await import('fs');
                const fileStream = fs.createReadStream(file.filepath);
                formData.append('file', fileStream, {
                    filename: file.originalFilename,
                    contentType: file.mimetype
                });
            }
        }

        // Forward to n8n webhook
        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });

        const result = await response.json().catch(() => ({}));
        
        console.log('n8n response status:', response.status);
        
        res.status(response.status).json(result);

    } catch (error) {
        console.error('Upload proxy error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}