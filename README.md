# Pioneers AI Front Desk

An AI-powered front desk assistant for **Pioneers Learning Center** (Raleigh, NC), built as a full-stack React + Node.js application. Parents can ask questions about center policies in a chat interface, while operators get a dashboard to review and resolve escalated inquiries.

**Live demo:** https://pioneers-ai-frontdesk.vercel.app

---

## Features

**Parent View**
- Conversational chat interface powered by Claude (Anthropic)
- Answers questions about hours, tuition, sick-child policy, tours, and more
- Automatic fallback to local policy-based responses if the AI endpoint is unavailable — UI always works for demo
- Flags responses the AI cannot confidently answer and escalates them to the operator

**Operator Dashboard**
- Real-time badge counter showing unresolved flagged questions
- Resolution workflow with categorized options (Connect staff, Policy clarification, Escalate to operator, Other)
- Free-text notes for custom resolutions
- Resolved question history log
- Live policy editor — changes take effect immediately in the parent chat context

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, CSS (custom, no UI library) |
| AI | Anthropic Claude API (`claude-haiku`) |
| Backend | Node.js + Express (API proxy — keeps API key server-side) |
| Deployment | Vercel (serverless) |
| Testing | Jest + React Testing Library (41 tests) |

---

## Architecture

```
Browser (React)
    │
    │  POST /api/claude/reply
    ▼
Express server (server.js)          ← API key never leaves server
    │
    │  POST https://api.anthropic.com/v1/messages
    ▼
Anthropic Claude API
```

The Express server acts as a secure proxy so the Anthropic API key is never exposed to the browser.

---

## Getting Started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/pioneers-ai-frontdesk.git
cd pioneers-ai-frontdesk
npm install
```

### Environment variables

Create a `.env` file in the project root:

```env
REACT_APP_ANTHROPIC_API_KEY=your_api_key_here
REACT_APP_ANTHROPIC_MODEL=claude-haiku-4-5-20251001   # optional
```

### Run locally

```bash
npm start
```

Opens [http://localhost:3000](http://localhost:3000). This concurrently starts the React dev server and the Express proxy on port 8787.

---

## Running Tests

```bash
npm test
```

41 tests covering:
- Policy flatten/unflatten round-trip
- Parent chat send, receive, error, and escalation flows
- Fallback keyword matching (`getFallbackReply`)
- Escalation detection patterns (`shouldEscalateReply`)
- CustomSelect component (open, close, select, outside click, Other textarea)
- Operator dashboard (flag display, resolve workflow, badge lifecycle, policy editor)

---

## Project Structure

```
src/
├── App.js              # All component and business logic
├── App.css             # Styles
├── App.test.js         # Full test suite
└── data/
    └── centerData.json # Center info and policy data
server.js               # Express API proxy
vercel.json             # Vercel deployment config
```

---

## API

`POST /api/claude/reply`

Request:
```json
{
  "system": "You are the AI Front Desk for Pioneers Learning Center...",
  "messages": [
    { "role": "user", "content": "What are your hours?" }
  ]
}
```

Response:
```json
{
  "reply": "We are open Monday-Friday 7:00 AM - 6:00 PM."
}
```

---

## Security Notes

- The Anthropic API key is kept on the server — never sent to the browser
- `.env` is listed in `.gitignore` and must not be committed
- All user input is passed through as message content only — no eval or shell execution
