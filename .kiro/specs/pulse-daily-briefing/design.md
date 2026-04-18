# Pulse — Design

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Auth:** NextAuth.js (OAuth para GitHub y Google)
- **AI:** Gemini API (google ai sdk)
- **Voice:** ElevenLabs TTS + Conversational AI
- **Storage:** Vercel KV (tokens, briefing cache)
- **Deployment:** Vercel

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│                  Next.js App                │
│                                             │
│  ┌──────────┐    ┌──────────────────────┐   │
│  │  Client  │    │     API Routes       │   │
│  │          │    │                      │   │
│  │Dashboard │───▶│ /api/briefing/generate│  │
│  │Player    │    │ /api/briefing/status  │   │
│  │Assistant │───▶│ /api/assistant/session│  │
│  └──────────┘    └──────────┬───────────┘   │
└─────────────────────────────┼───────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
    GitHub API          Google API          Jira API
    (commits,           (calendar,          (tickets,
     PRs, reviews)       events)             sprints)
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
                        Gemini API
                    (síntesis y análisis)
                              │
                              ▼
                      ElevenLabs API
                    (TTS + Conversational)
                              │
                              ▼
                        Vercel KV
                    (cache del briefing)
```

---

## Folder Structure

```
pulse/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx          # Landing + onboarding
│   │   └── callback/
│   │       └── page.tsx          # OAuth callback handler
│   ├── dashboard/
│   │   └── page.tsx              # Main view
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts      # NextAuth handlers
│   │   ├── briefing/
│   │   │   ├── generate/
│   │   │   │   └── route.ts      # Orquesta todo el pipeline
│   │   │   └── status/
│   │   │       └── route.ts      # Estado del briefing del día
│   │   ├── sources/
│   │   │   ├── github/
│   │   │   │   └── route.ts      # Fetch GitHub activity
│   │   │   ├── google/
│   │   │   │   └── route.ts      # Fetch Google Calendar
│   │   │   └── jira/
│   │   │       └── route.ts      # Fetch Jira tickets
│   │   └── assistant/
│   │       └── session/
│   │           └── route.ts      # ElevenLabs Conv. AI session
│   └── layout.tsx
├── components/
│   ├── onboarding/
│   │   ├── OnboardingFlow.tsx    # Wizard de conexión de cuentas
│   │   └── SourceCard.tsx        # Card por cada integración
│   ├── dashboard/
│   │   ├── BriefingPlayer.tsx    # Audio player principal
│   │   ├── TranscriptPanel.tsx   # Transcript sincronizado
│   │   ├── SourceStatus.tsx      # Estado de cada fuente
│   │   └── AssistantButton.tsx   # Activa el agente de voz
│   └── ui/                       # Componentes base (Button, Card...)
├── lib/
│   ├── sources/
│   │   ├── github.ts             # GitHub API client
│   │   ├── google.ts             # Google Calendar client
│   │   └── jira.ts               # Jira API client
│   ├── ai/
│   │   ├── synthesize.ts         # Llama a Gemini para generar briefing
│   │   └── prompts.ts            # Todos los prompts centralizados
│   ├── voice/
│   │   ├── tts.ts                # ElevenLabs TTS
│   │   └── conversational.ts     # ElevenLabs Conv. AI
│   └── cache/
│       └── briefing.ts           # Vercel KV read/write
├── types/
│   └── index.ts                  # Tipos globales
└── .kiro/
    ├── specs/
    │   ├── requirements.md
    │   ├── design.md
    │   └── tasks.md
    └── steering/
        ├── project.md            # Contexto global del proyecto
        ├── voice.md              # Reglas para todo lo relacionado a voz
        └── data-sources.md      # Patrones para las integraciones
```

---

## Data Models

```typescript
// El briefing del día
interface DailyBriefing {
  id: string
  userId: string
  date: string                    // YYYY-MM-DD
  status: 'pending' | 'generating' | 'ready' | 'error'
  sources: {
    github: GitHubActivity | null
    google: GoogleActivity | null
    jira: JiraActivity | null
  }
  content: BriefingContent | null
  audioUrl: string | null
  generatedAt: string | null
}

// Lo que Gemini genera
interface BriefingContent {
  summary: string                 // 1-2 oraciones de apertura
  achievements: string[]          // Qué se completó ayer
  pending: PendingItem[]          // PRs, tickets, tareas abiertas
  blockers: BlockerItem[]         // Ordenados por urgencia
  todaySchedule: CalendarEvent[]  // Reuniones del día
  wordCount: number
}

// Actividad de GitHub
interface GitHubActivity {
  commits: Commit[]
  openPRs: PullRequest[]
  pendingReviews: PullRequest[]
  closedIssues: Issue[]
  mergedPRs: PullRequest[]
}

// Actividad de Google Calendar
interface GoogleActivity {
  events: CalendarEvent[]
  totalMeetingMinutes: number
}

// Actividad de Jira
interface JiraActivity {
  inProgress: JiraTicket[]
  movedYesterday: JiraTicket[]
  blockers: JiraTicket[]
  sprintName: string
}
```

---

## API Routes — Detalle

### `POST /api/briefing/generate`
El corazón del sistema. Orquesta todo el pipeline:

```
1. Verificar que no existe un briefing del día en caché
2. Fetch paralelo: GitHub + Google + Jira
3. Enviar data agregada a Gemini
4. Recibir BriefingContent estructurado
5. Enviar texto a ElevenLabs TTS
6. Guardar audio URL + content en Vercel KV
7. Retornar briefing completo al cliente
```

### `GET /api/briefing/status`
Retorna el briefing del día si existe en caché.
Si no existe, retorna `{ status: 'pending' }`.

### `POST /api/assistant/session`
Crea una sesión de ElevenLabs Conversational AI
con el briefing del día como contexto inicial del agente.

---

## Gemini Prompt Strategy

El prompt principal que va a `synthesize.ts`:

```
You are Pulse, a professional but warm daily briefing
assistant. You receive raw activity data from GitHub,
Google Calendar, and Jira.

Your job is to produce a briefing that:
- Opens with a 1-sentence energy-setting summary
- Groups achievements clearly
- Flags blockers FIRST before pending items
- Mentions today's meetings chronologically
- Uses second person ("you merged", "your PR")
- Stays under 350 words
- Never uses bullet points in the spoken text
  (it will be converted to audio)

Return a JSON object matching the BriefingContent interface.
Raw data:
{AGGREGATED_DATA}
```

---

## ElevenLabs Integration

### TTS (briefing)
- **Voice:** Configurar una voz custom llamada "Pulse"
- **Model:** `eleven_turbo_v2` (más rápido, suficiente calidad)
- **Output:** MP3, guardado en Vercel Blob

### Conversational AI (asistente)
- El agente recibe como system prompt el briefing del día
- Habilitado para responder preguntas sobre PRs, tickets y reuniones
- Sesión con timeout de 5 minutos de inactividad

---

## Kiro Steering Docs

Tres archivos en `.kiro/steering/` que guían a Kiro
durante todo el desarrollo:

### `project.md` — Contexto global
- Qué es Pulse, stack, decisiones de arquitectura
- Convenciones de naming y estructura de carpetas
- Regla: toda llamada a API externa va en `/lib/`, nunca en componentes

### `voice.md` — Reglas de voz
- El texto generado por Gemini nunca debe tener bullets
  porque va a TTS
- Máximo 350 palabras por briefing
- Tono: profesional pero conversacional

### `data-sources.md` — Patrones de integración
- Cada source retorna su tipo específico o `null`
- Siempre manejar el caso de source caído
- Los tokens OAuth nunca tocan el cliente

---

## Out of Scope (MVP)
- Team / multi-user features
- Slack o Linear integrations
- Native mobile app
- Briefing history más allá de 7 días
- Notificaciones push
