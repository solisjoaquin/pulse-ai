# Pulse

> Your workday, before you open Slack.

Pulse is a voice-first team intelligence tool that aggregates work activity from GitHub, Google Calendar, and Jira across your entire team — and delivers a personalized 2-minute audio briefing every morning.

No status updates. No standups. No interrupting your teammates.

---

## The Problem

Distributed teams lose hours every week to a simple question: **what is everyone working on?**

So they schedule standups. Daily syncs. Quick calls. And still — duplicate work happens, PRs conflict, and someone always gets interrupted mid-flow to answer "hey, are you touching the auth module?"

Pulse eliminates that overhead entirely, without adding anything to anyone's calendar.

---

## How It Works

1. **Connect your tools** — GitHub, Google Calendar, and optionally Jira
2. **Invite your team** — each member connects their own accounts
3. **Generate your briefing** — Pulse reads your activity and your team's, synthesizes it with Gemini, and generates a 2-3 minute audio briefing via ElevenLabs
4. **Ask anything** — activate the voice assistant to ask what your teammates are working on, who is touching which module, or what meetings you have after lunch

---

## Features

### Personal daily briefing
A personalized audio summary of your last 24 hours: commits merged, PRs open, Jira tickets in progress, blockers, and today's meeting schedule. Generated fresh, on demand.

### Team overlap detection
Pulse analyzes your entire team's activity and detects three types of overlap:

- 🔴 **Conflict** — two people have open PRs modifying the same files. Requires immediate attention.
- 🟢 **Synergy** — two people are building semantically similar features in different parts of the codebase. An opportunity to share context.
- ⚪ **Awareness** — two people are active in the same repository with no direct overlap. Good to know.

### Voice assistant
Ask Pulse about your work or your teammates' work in natural language:

- *"Which of my PRs has been open the longest?"*
- *"What is Ana working on today?"*
- *"Who else is touching the auth module?"*
- *"Is anyone building something similar to my caching PR?"*

Pulse answers based only on observed activity — it never fabricates.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | NextAuth.js |
| AI | Google Gemini 2.5 Flash |
| Voice | ElevenLabs TTS + Conversational AI |
| Storage | Vercel KV + Vercel Blob |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A GitHub OAuth App
- A Google OAuth App (Calendar scope)
- A Gemini API key
- An ElevenLabs API key and voice ID
- A Vercel account (for KV and Blob)

### Installation

```bash
git clone https://github.com/your-username/pulse
cd pulse
npm install
```

### Environment variables

Create a `.env.local` file in the root of the project:

```env
# Auth
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI
GEMINI_API_KEY=your_gemini_api_key

# Voice
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id

# Storage
KV_REST_API_URL=your_vercel_kv_url
KV_REST_API_TOKEN=your_vercel_kv_token
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token

# Demo mode (skip OAuth, use mock data)
DEMO_MODE=false
```

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo mode

To explore Pulse without connecting real accounts, set `DEMO_MODE=true` in your `.env.local`. This loads a pre-built team of 4 members with realistic activity data, including one conflict, one synergy, and one awareness overlap — no credentials required.

---

## Project Structure

```
pulse/
├── app/
│   ├── (auth)/login/          # Landing and onboarding
│   ├── dashboard/             # Personal briefing view
│   ├── dashboard/team/        # Team intelligence view
│   └── api/                   # API routes
├── components/
│   ├── dashboard/             # Player, transcript, assistant
│   └── team/                  # Member cards, overlap alerts
├── lib/
│   ├── sources/               # GitHub, Google, Jira clients
│   ├── team/                  # Activity aggregation, overlap detection
│   ├── ai/                    # Gemini synthesis and overlap analysis
│   ├── voice/                 # ElevenLabs TTS and Conversational AI
│   ├── cache/                 # Vercel KV read/write
│   └── mock/                  # Demo mode data
├── types/
│   └── index.ts               # All TypeScript interfaces
└── .kiro/
    ├── specs/                 # requirements.md, design.md, tasks.md
    └── steering/              # project.md, voice.md, data-sources.md
```

---

## Built With Kiro

This project was built using [Kiro](https://kiro.dev) — AWS's spec-driven AI IDE. The entire development workflow was structured around Kiro's features:

- **Spec-driven development** — `requirements.md`, `design.md`, and `tasks.md` defined the full system before a single line of code was written. Each of the 23 tasks references specific requirements, creating a traceable path from idea to implementation.

- **Steering docs** — Three steering documents in `.kiro/steering/` guided every code generation decision: architecture conventions, voice output rules, API patterns, and mock data structure. Kiro respected these constraints across the entire codebase without needing to be reminded.

- **Agent hooks** — Automated the overlap detection pipeline to run after every team activity aggregation, and triggered briefing pre-generation before the user's scheduled time.

- **MCP integration** — Extended Kiro with GitHub and Jira MCP servers to interact directly with the APIs being integrated, accelerating the development of the data source clients.

- **Vibe coding** — Used for rapid iteration on UI components and prompt engineering, complementing the spec-driven foundation.

---

## Built With ElevenLabs

ElevenLabs powers the two voice experiences at the core of Pulse:

- **Text-to-Speech** — The daily briefing is generated as a natural-sounding MP3 using the `eleven_turbo_v2` model with a custom "Pulse" voice. The Gemini output is specifically prompted to produce prose optimized for speech — no bullet points, no markdown, no abbreviations.

- **Conversational AI** — The voice assistant is powered by ElevenLabs Conversational AI, pre-loaded with the user's briefing and their entire team's activity as context. It answers questions about individual and team work in real time, by voice.

---

## Privacy

- Team members see only AI-derived summaries of their teammates' work — never raw commits, file paths, or ticket details
- OAuth tokens are stored server-side only and never exposed to the client
- Team data is strictly scoped — no information crosses team boundaries
- Any member can disconnect a data source at any time from settings

---

## Hackathon

Built for the **ElevenLabs x Kiro Hackathon**.

---

## License

MIT