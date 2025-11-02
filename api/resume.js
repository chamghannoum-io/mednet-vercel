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
        const { resumeUrl, data } = req.body;
        
        if (!resumeUrl) {
            return res.status(400).json({ error: 'resumeUrl is required' });
        }

        console.log('Proxying request to:', resumeUrl);
        console.log('With data:', JSON.stringify(data, null, 2));

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
}