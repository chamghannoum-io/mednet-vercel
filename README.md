# MedNet Document Processing Interface

HTML interface for uploading medical documents to n8n, with editable field validation and workflow resumption.

## Quick Start

### 1. Configure the Application

Edit `config.js` with your n8n webhook URL and settings:
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

### Multi-Step Workflow with resumeURL

The system uses n8n's resumeURL feature to create a multi-step workflow that pauses and resumes at key points:

```
┌─────────┐          ┌─────────┐          ┌─────────┐
│ User    │          │ Backend │          │ n8n     │
│ Browser │          │ Server  │          │ Workflow│
└────┬────┘          └────┬────┘          └────┬────┘
     │                    │                     │
     │ STEP 1: Upload & Extract                │
     │ ─────────────────────────────────────── │
     │ 1. Upload Files    │                     │
     ├───────────────────>│                     │
     │                    │ 2. Forward to n8n   │
     │                    ├────────────────────>│
     │                    │                     │ 3. Extract data
     │                    │                     │ 4. Wait Node 1
     │                    │ 5. Extracted data   │ 5. Respond to Webhook
     │                    │    + resumeURL1     │    (returns immediately)
     │                    │<────────────────────┤
     │ 6. Display Data    │                     │
     │<───────────────────┤                     │
     │                    │                     │
     │ STEP 2: Fetch Claim Summary             │
     │ ─────────────────────────────────────── │
     │ 7. Call resumeURL1 │                     │
     ├───────────────────>│                     │
     │                    │ 8. Forward to n8n   │
     │                    ├────────────────────>│
     │                    │                     │ 9. Resume workflow
     │                    │                     │ 10. Generate coding
     │                    │                     │ 11. Wait Node 2
     │                    │ 12. Claim summary   │ 12. Respond to Webhook
     │                    │     + resumeURL2    │
     │                    │<────────────────────┤
     │ 13. Display summary│                     │
     │<───────────────────┤                     │
     │                    │                     │
     │ STEP 3: Save Confirmation               │
     │ ─────────────────────────────────────── │
     │ 14. User edits     │                     │
     │     & clicks Save  │                     │
     │ 15. Call resumeURL2│                     │
     ├───────────────────>│                     │
     │                    │ 16. Forward to n8n  │
     │                    ├────────────────────>│
     │                    │                     │ 17. Resume workflow
     │                    │                     │ 18. Send email
     │                    │ 19. Success         │ 19. Complete
     │                    │<────────────────────┤
     │ 20. Show success   │                     │
     │<───────────────────┤                     │
     └────────────────────┴─────────────────────┘
```

#### Frontend Behavior
1. **Initial Call**: User uploads documents → n8n returns extracted info + **resumeURL1**
2. **Immediate Second Call**: Frontend automatically calls **resumeURL1** to trigger claim summary generation
3. **Loading State**: "View Claim Summary" button shows "Loading Claim Summary..." during processing
4. **Display Summary**: Once received, button becomes active and displays claim summary + **resumeURL2**
5. **User Confirmation**: User reviews, edits data, and clicks "Save Changes"
6. **Final Call**: Frontend calls **resumeURL2** to complete the workflow and trigger email

#### n8n Workflow Setup

The n8n workflow should follow this structure:

**Step 1: Initial Document Processing**
```
Webhook (Initial)
  → Code in JavaScript
  → Extract from File
  → Aggregate
  → Get Document Fields
  → Respond to Webhook
      Response Body:
      {
        "invoice_number": "{{ $json.invoice_number }}",
        "claimed_amount": {{ $json.claimed_amount }},
        "resumeURL": "{{ $execution.resumeUrl }}"
      }
  → Wait Node 1 (Resume: On webhook call)
```

**Step 2: Claim Summary Generation**
```
  → Coding (AI/LLM to generate medical coding)
  → Respond to Webhook
      Response Body:
      {
        "success": true,
        "coding": "{{ $json.coding }}",
        "resumeURL": "{{ $execution.resumeUrl }}"
      }
  → Wait Node 2 (Resume: On webhook call)
```

**Step 3: Final Processing**
```
  → UniqueID
  → HTML
  → Send a message (email with results)
  → End
```

**Key Configuration Points:**
- Each **Wait Node** should be set to **"Resume: On webhook call"**
- Each **Respond to Webhook** should include `{{ $execution.resumeUrl }}` in the response
- All processing happens within n8n nodes - no external HTTP requests needed

**Example Response Formats:**

*Response 1 (Extracted Info + resumeURL1):*
```json
{
  "invoice_number": "INV-123",
  "claimed_amount": 500.00,
  "patient_name": "John Doe",
  "resumeURL": "https://n8n-test.iohealth.com/webhook/abc123..."
}
```

*Response 2 (Claim Summary + resumeURL2):*
```json
{
  "success": true,
  "coding": "## Primary diagnose\n*Description*: Dental Caries\n*Code*: K02.5",
  "resumeURL": "https://n8n-test.iohealth.com/webhook/xyz789..."
}
```

#### Backend Endpoints

| Endpoint | Method | Purpose | From |
|----------|--------|---------|------|
| `/upload` | POST | Upload documents to n8n webhook | Frontend |
| `/resume` | POST | Resume workflow with data (handles both resumeURL1 and resumeURL2) | Frontend |

#### Testing the Multi-Step Workflow

1. **Upload a document** through the interface
2. **View extracted info** - Should appear immediately
3. **Wait for claim summary** - Loading button should automatically fetch and display
4. **Edit fields if needed**
5. **Click "Save Changes"** - Triggers final workflow completion and email

---

## Deployment

### Deploying to Render

This app is configured to run on Render.com:

**Production URL**: https://mednet-afqz.onrender.com

**n8n Configuration for Production**:
- Set your n8n webhook URL in `config.js` to point to your n8n instance
- The workflow will use n8n's built-in `{{ $execution.resumeUrl }}` for pausing/resuming
- No additional configuration needed - resumeURLs are automatically generated by n8n

**Build Command**: `npm install`
**Start Command**: `npm start`

The server will automatically use `process.env.PORT` (Render sets this automatically).
