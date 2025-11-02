# MedNet Document Processing Interface

HTML interface for uploading medical documents to n8n, with editable field validation and workflow resumption.

## Quick Start

### 1. Configure the Application

Edit `config.js` with your webhook URL and settings:
```javascript
const CONFIG = {
    WEBHOOK_URL: 'https://your-n8n-instance.com/webhook/your-webhook-id',
    USE_CORS_PROXY: true,
    CORS_PROXY_BASE_URL: 'http://localhost:3002',
    MAX_FILE_SIZE: 50 * 1024 * 1024,
    MAX_FILES: 5
};
```

### 2. Choose Your Setup

**Option A: Use CORS Proxy**

```bash
npm install
npm start
```

Then open `interface.html` in your browser.

**Option B: Fix n8n CORS**

Add these headers to your n8n webhook response:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Set `USE_CORS_PROXY: false` in `config.js`.

## Files

- `interface.html` - Main interface
- `config.js` - Configuration file (create from config.example.js)
- `config.example.js` - Configuration template
- `cors-proxy.js` - CORS proxy server
- `confirmation.html` - Success confirmation page
- `server.js` - Simple static server

## Configuration

All configuration is centralized in `config.js`:

| Setting | Description | Default |
|---------|-------------|---------|
| `WEBHOOK_URL` | Your n8n webhook URL | Required |
| `USE_CORS_PROXY` | Use local CORS proxy | `true` |
| `CORS_PROXY_BASE_URL` | CORS proxy server URL | `http://localhost:3002` |
| `MAX_FILE_SIZE` | Maximum file size in bytes | `52428800` (50 MB) |
| `MAX_FILES` | Maximum number of files | `5` |
| `REQUIRED_FIELDS` | Always required fields | `['claimed_amount']` |
| `EITHER_OR_FIELDS` | At least one required | `['receipt_number', 'invoice_number']` |

## How It Works

1. User uploads medical document
2. File sent to n8n webhook for processing
3. n8n extracts data and returns JSON with `resumeUrl`
4. Interface displays editable fields
5. User corrects any errors
6. Clicks "Save Changes" → data sent to `resumeUrl`
7. n8n workflow resumes with corrected data
