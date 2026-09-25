# Architecture

Astral Compass is a small full-stack Node.js app. The frontend is a single-page static HTML/CSS/JS bundle. The backend is a minimal Express server.

## Overview

```
Browser (public/)
  ├── index.html   — single-page UI, onboarding + dashboard + chat
  ├── styles.css   — dark cosmic design system, all tokens inline
  └── app.js       — zodiac logic, horoscope render, chat state, fetch calls
         │
         │  GET /api/horoscope?sign=leo
         │  POST /api/chat  { systemPrompt, messages }
         ▼
Express server (server.js)
  ├── Serves public/ as static files
  ├── GET /api/horoscope → fetches Aztro API (daily/weekly/monthly)
  ├── POST /api/chat     → builds Groq request, returns { answer }
  └── Security: helmet, rate-limit, input sanitisation, CORS
```

## Folder Map

```
astral-compass/
├── docs/
│   ├── ARCHITECTURE.md
│   └── DEPLOYMENT.md
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .env.example
├── .gitignore
├── LICENSE
├── package.json
├── README.md
└── server.js
```

## Horoscope Flow

1. User enters name + birthday → browser calculates sun sign.
2. `GET /api/horoscope?sign=leo` → server fetches Aztro for daily, weekly, monthly data.
3. Server returns condensed JSON.
4. Frontend renders reading text and animated signal bars.

## Chat Flow

1. User submits question.
2. `POST /api/chat` — body contains `systemPrompt` (built from profile + horoscope) and recent `messages` array.
3. Server sanitises inputs, trims to safe token budget, calls Groq `llama3-8b-8192`.
4. Server returns `{ answer, model }`.
5. Frontend renders reply and appends to local chat history (max 24 turns).

## Privacy

- User profile is held **in memory only** — never written to a database.
- Profile details are sent to Groq only as part of the system prompt when the user asks a question.
- Clearing data in the browser deletes everything immediately.
