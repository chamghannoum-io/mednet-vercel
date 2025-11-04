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

### Basic Flow
1. User uploads medical document
2. File sent to n8n webhook for processing
3. n8n extracts data and returns JSON with `resumeUrl`
4. Interface displays editable fields
5. User corrects any errors
6. Clicks "Save Changes" → data sent to `resumeUrl`
7. n8n workflow resumes with corrected data

### Two-Payload System (Async Coding)

The system now supports receiving medical coding data asynchronously after the initial document extraction:

```
┌─────────┐          ┌─────────┐          ┌─────────┐
│ User    │          │ Backend │          │ n8n     │
│ Browser │          │ Server  │          │ Workflow│
└────┬────┘          └────┬────┘          └────┬────┘
     │                    │                     │
     │ 1. Upload Files    │                     │
     ├───────────────────>│                     │
     │                    │ 2. Forward to n8n   │
     │                    ├────────────────────>│
     │                    │                     │ 3. Extract data
     │                    │                     │ 4. Respond to Webhook
     │                    │ 5. Extracted data   │    (returns immediately)
     │                    │<────────────────────┤
     │ 6. Display Data    │                     │ 7. Continue workflow
     │    + Loading Button│                     │    Generate coding...
     │<───────────────────┤                     │
     │                    │                     │
     │ 8. Poll /coding    │                     │
     ├───────────────────>│                     │
     │ (404 - not ready)  │                     │
     │<───────────────────┤                     │
     │                    │                     │
     │ 9. Poll again...   │                     │
     ├───────────────────>│                     │
     │ (404 - not ready)  │                     │ 10. Coding ready!
     │<───────────────────┤                     │
     │                    │                     │ 11. HTTP Request
     │                    │ 12. POST /coding    │     sends to backend
     │                    │    (coding data)    │
     │                    │<────────────────────┤
     │                    │ 13. Store in memory │
     │ 14. Poll /coding   │                     │
     ├───────────────────>│                     │
     │ 15. Return coding  │                     │
     │<───────────────────┤                     │
     │ 16. Display coding │                     │
     │     button active! │                     │
     └────────────────────┴─────────────────────┘
```

#### Frontend Behavior
1. **First Request**: User uploads documents → n8n "Respond to Webhook" returns extracted info (without coding)
2. **Loading State**: "View Claim Summary" button shows "Loading Claim Summary..." with spinning animation
3. **Polling**: Frontend polls `GET /coding/latest` every 1 second for up to 60 seconds
4. **n8n Sends Coding**: n8n HTTP Request node POSTs coding data to `/coding` endpoint
5. **Update UI**: Frontend polling detects the data, button becomes active, displays formatted medical coding

#### n8n Workflow Setup

**Node 1: Respond to Webhook**
- Returns extracted data immediately
- Does NOT include coding field
```json
{
  "invoice_number": "INV-123",
  "claimed_amount": 500.00,
  "resumeUrl": "https://n8n-test.iohealth.com/webhook/resume-abc123"
}
```

**Node 2: Generate Coding**
- Workflow continues after responding
- Run AI/LLM to generate medical coding (~5 seconds)

**Node 3: HTTP Request** (Send to Backend)
- **Method**: POST
- **URL**: `http://YOUR_IP:3002/coding` (use your machine's IP, not localhost!)
  - Example: `http://192.168.1.100:3002/coding`
  - Or if n8n in Docker: `http://host.docker.internal:3002/coding`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "coding": "{{ $json.coding }}",
  "sessionId": "latest"
}
```

#### Backend Endpoints

| Endpoint | Method | Purpose | From |
|----------|--------|---------|------|
| `/upload` | POST | Upload documents to n8n | Frontend |
| `/resume` | POST | Save edited data to n8n | Frontend |
| `/coding` | POST | **Receive coding from n8n** | **n8n HTTP Request** |
| `/coding/:sessionId` | GET | Poll for coding data | Frontend |

#### Testing the Two-Payload System

**Option 1: Browser Console (Easiest)**
```javascript
// Simulate n8n sending coding data
testSecondPayload()
```

**Option 2: Manual API Call (Simulates n8n)**
```bash
curl -X POST http://localhost:3002/coding \
  -H "Content-Type: application/json" \
  -d '{"coding": "---\n\n## Primary diagnose\n*Description*: Test\n*Code*: K02.5", "sessionId": "latest"}'
```

**Option 3: Use Your n8n Workflow**
- Configure HTTP Request node with your machine's IP address
- Upload documents and watch the loading animation
- Coding should appear automatically after a few seconds
