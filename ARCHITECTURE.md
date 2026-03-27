# System Architecture & Design Overview

> **Approach:** Breadth-first — this prototype was scoped to capture the general idea across both workflows and gather early feedback. Depth (persistence, scalability, auth, etc.) is intentionally deferred to a future iteration.

---

## Table of Contents

1. [Parent Workflow](#1-parent-workflow)
2. [Operator Workflow](#2-operator-workflow)
3. [Feature Summary](#3-feature-summary)
4. [Technical Considerations & Trade-offs](#4-technical-considerations--trade-offs)
5. [Known Limitations](#5-known-limitations)
6. [Future Improvements](#6-future-improvements)

---

## 1. Parent Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                        PARENT VIEW                              │
└─────────────────────────────────────────────────────────────────┘

  Parent types a question
          │
          ▼
  ┌───────────────┐
  │  Input Guard  │  ── empty input? → block send
  └───────┬───────┘
          │ valid message
          ▼
  ┌───────────────────┐
  │  Append to chat   │  role: "user"
  │  Set loading=true │
  └────────┬──────────┘
           │
           ▼
  ┌──────────────────────────┐
  │  POST /api/claude/reply  │
  │  { system, messages }    │  ← system prompt built from
  └──────────┬───────────────┘    centerData.json policies
             │
      ┌──────┴──────┐
      │             │
   success        error
      │             │
      ▼             ▼
  AI reply     Fallback reply         ← keyword match on user text
      │         (getFallbackReply)       (hours / fever / cost / etc.)
      │             │
      └──────┬──────┘
             │
             ▼
  ┌──────────────────────────┐
  │  shouldEscalateReply()?  │
  │  (regex pattern match)   │
  └──────────┬───────────────┘
             │
      ┌──────┴──────┐
      │             │
    YES             NO
      │             │
      ▼             ▼
  Flag question  Render reply
  → Operator     in chat window
    queue
```

**Key states:** idle → loading → reply rendered (or error banner shown)

---

## 2. Operator Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                      OPERATOR DASHBOARD                         │
└─────────────────────────────────────────────────────────────────┘

  Operator opens dashboard
          │
          ▼
  ┌────────────────────────────────────────────────┐
  │  Badge counter shows unresolved flagged count  │
  └────────────────────┬───────────────────────────┘
                       │
          ┌────────────┼─────────────┐
          │            │             │
          ▼            ▼             ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐
  │  1) Flagged  │ │ 2) Policy    │ │  3) Knowledge Base   │
  │   Questions  │ │   Editor     │ │     (read-only JSON) │
  └──────┬───────┘ └──────┬───────┘ └──────────────────────┘
         │                │
         ▼                ▼
  For each flagged     Edit policy field
  question:            value inline
         │                │
         ▼                ▼
  Select resolution    Changes applied
  type:                immediately to
   • Connect staff     AI system context
   • Policy clarif.    (in-memory only)
   • Escalate oper.
   • Other (+ notes)
         │
         ▼
  ┌─────────────────────┐
  │  OTHER selected?    │
  └──────────┬──────────┘
             │
      ┌──────┴──────┐
      │             │
    YES             NO
      │             │
      ▼             ▼
  Require notes   Resolve button
  (textarea)      enabled immediately
      │
      ▼ (notes entered)
  Resolve button enabled
      │
      ▼
  Click Resolve
      │
      ▼
  ┌──────────────────────────────────────────┐
  │  Move item: unresolved list → resolved   │
  │  Stamp resolvedAt timestamp              │
  │  Badge count decrements                  │
  │  Show in Resolved Questions section      │
  └──────────────────────────────────────────┘
```

---

## 3. Feature Summary

### Parent Mode

| Feature | Description |
|---|---|
| Conversational chat | Full message history sent to Claude on each request for context-aware replies |
| AI-powered answers | Claude responds using a system prompt built from the center's policy JSON |
| Graceful degradation | If Claude is unreachable, local keyword-based fallback always returns a useful response |
| Escalation detection | Regex patterns detect when AI is uncertain; question is silently flagged for operator review |
| Loading state | Send button disabled and shows "Sending…" to prevent duplicate submissions |
| Error banner | Non-blocking error message shown when using fallback, without breaking the chat flow |

### Operator Mode

| Feature | Description |
|---|---|
| Flagged question queue | All escalated questions surface here with timestamps |
| Badge counter | Live count on the tab header of unresolved items; disappears when queue is cleared |
| Resolution workflow | Categorised resolution types with enforced notes requirement for "Other" |
| Resolved history | Completed items move to a persistent (in-session) resolved log with resolution text |
| Inline policy editor | Every policy field is directly editable; changes immediately affect the AI system prompt |
| Knowledge base viewer | Read-only formatted JSON view of the current effective policy state |

---

## 4. Technical Considerations & Trade-offs

### Secure API proxy
**Decision:** The Anthropic API key lives in `server.js` (Node/Express), never in the browser bundle.  
**Trade-off:** Adds a network hop vs. calling Anthropic directly from the client, but is required for security — browser-exposed keys can be scraped.

### Single-file component architecture
**Decision:** All React components (`ParentView`, `OperatorView`, `CustomSelect`, `App`) live in `App.js`.  
**Trade-off:** Fast to build and easy to demo, but does not scale as the feature set grows. A production codebase would split into `components/`, `hooks/`, and `services/`.

### In-memory state only
**Decision:** All state (messages, flags, resolutions, policy edits) is held in React `useState`. Refreshing the page resets everything.  
**Trade-off:** Zero infrastructure needed for a prototype. A real product needs a database (e.g. PostgreSQL) and session management.

### Policy editing without a schema layer
**Decision:** Policy fields are flattened to key-value pairs for the editor (e.g. `tuition.infant`), then unflattened back to JSON for the AI system prompt.  
**Trade-off:** Simple and functional for a fixed policy shape, but adding nested or array-type policies would require a richer form schema.

### Escalation via regex pattern matching
**Decision:** `shouldEscalateReply()` uses hardcoded regex patterns to detect uncertain AI replies.  
**Trade-off:** Predictable and testable, but brittle. A production approach would use a structured confidence field in the AI response payload or a secondary classifier.

### Breadth-first requirement coverage
**Decision:** Both workflows are implemented end-to-end (parent chat and operator dashboard), but each at shallow depth.  
**Trade-off:** Covers the full user journey for demo and feedback purposes. Production readiness requires deepening each area (auth, persistence, audit logs, etc.).

---

## 5. Known Limitations

| Area | Limitation |
|---|---|
| **Persistence** | No database — all data (flags, resolutions, policy edits) is lost on page refresh |
| **Authentication** | No login or role-based access control — anyone can access the operator dashboard |
| **Scalability** | Single Express process; no load balancing, rate limiting, or queue management |
| **Fault tolerance** | If the Express proxy crashes, parent chat falls back to local responses but no alerting or recovery exists |
| **Multi-tenancy** | Hard-coded to a single learning center; no support for multiple centers or locations |
| **Conversation history** | Full message history is sent to Claude on every request — token cost grows unbounded in long sessions |
| **Audit trail** | Operator resolutions are stored in-memory only; no persistent log for compliance or review |
| **Testing depth** | Tests cover integration behaviour via the React UI; no isolated unit tests for `getFallbackReply` or `shouldEscalateReply` as pure functions, and no server-side API tests |
| **Accessibility** | Basic ARIA roles added to `CustomSelect`; full keyboard nav and screen-reader compliance not validated |
| **Mobile** | Responsive layout implemented but not fully tested across breakpoints |

---

## 6. Future Improvements

**Short term (next iteration)**
- Add a database layer (e.g. PostgreSQL via Prisma) to persist flags, resolutions, and policy history
- Implement operator authentication (JWT or session-based)
- Trim conversation history to a sliding window to control Claude token costs

**Medium term**
- Move policy management to a structured CMS or admin panel with versioning
- Replace regex escalation detection with a structured AI response schema (e.g. `{ reply, confidence, escalate: bool }`)
- Add rate limiting and request validation on the Express API
- Expand to support multiple centers with per-center policy sets

**Longer term**
- Push notifications or email alerts when new questions are flagged
- Analytics dashboard (escalation rate, common question topics, resolution times)
- Fine-tuned model on historical Q&A data for more accurate policy responses
- Full accessibility audit and WCAG 2.1 AA compliance
