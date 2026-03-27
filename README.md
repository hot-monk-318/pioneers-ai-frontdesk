# AI Front Desk Prototype

React prototype for Brightwheel interview exercise with two views:
- Parent chat (implemented)
- Operator dashboard (placeholder for next step)

## Run

```bash
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000).
This starts both the React app and a local Claude proxy server.

## Parent Chat Behavior

- Uses center policy data from `src/data/centerData.json`.
- Calls local backend endpoint `POST /api/claude/reply` (proxied to `server.js`).
- If endpoint is unavailable, it falls back to local policy-based responses so the UI still works for demo.

Expected request payload shape:

```json
{
  "system": "front desk instruction context",
  "messages": [
    { "role": "user", "content": "What are your hours?" }
  ]
}
```

Expected response payload shape:

```json
{
  "reply": "We are open Monday-Friday..."
}
```

## Security Note

Do not call Anthropic directly from browser code with a raw secret key. This project now calls Claude from `server.js` so the key stays on the server process.
