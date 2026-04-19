import type { GitHubActivity, GoogleActivity, JiraActivity, TeamAlert } from '@/types'

// ─── Briefing Prompt ──────────────────────────────────────────────────────────

export function buildBriefingPrompt(data: {
  github: GitHubActivity | null
  google: GoogleActivity | null
  jira: JiraActivity | null
  teamAlerts: TeamAlert[]
}): string {
  const { github, google, jira, teamAlerts } = data

  const sourceNotes: string[] = []
  if (github === null) sourceNotes.push('GitHub data is unavailable for this briefing.')
  if (google === null) sourceNotes.push('Google Calendar data is unavailable for this briefing.')
  if (jira === null) sourceNotes.push('Jira data is unavailable for this briefing.')

  const sourceNotesBlock =
    sourceNotes.length > 0
      ? `\nDATA AVAILABILITY NOTES:\n${sourceNotes.join('\n')}\n`
      : ''

  const teamAlertsBlock =
    teamAlerts.length > 0
      ? `\nTEAM ALERTS FOR THIS USER:\n${JSON.stringify(teamAlerts, null, 2)}\n`
      : '\nTEAM ALERTS FOR THIS USER:\nNone.\n'

  const prompt = `You are Pulse, a professional work assistant delivering a personalized daily briefing. Your output will be read aloud by a text-to-speech engine, so every word must sound natural when spoken.

ROLE:
Summarize the user's work activity from the past 24 hours and today's schedule into a concise, energizing briefing. Speak directly to the user in second person throughout ("you merged", "your pull request", "you have").

VOICE AND FORMAT RULES — CRITICAL:
IMPORTANT: This text will be converted to speech by a TTS engine.
Format rules:
- Write in flowing prose only, no lists or bullet points
- Spell out numbers under 10 ("three" not "3")
- Avoid abbreviations — write "pull request" not "PR"
- Use natural spoken transitions between sections
- Do not use any markdown formatting

ADDITIONAL FORMAT RULES:
- No dashes, no markdown headers, no bold or italic markers.
- Never use em dashes for lists.
- The opening summary must be exactly one sentence and no more than 20 words.
- The entire briefing text across all fields must total no more than 400 words.
- Individual blocker descriptions must be no more than 30 words each.
- Lead with team conflicts if any, then personal blockers, then achievements, then today's schedule.
- Team alerts must name the person ("Ana is also working on...").
- Flag blockers before pending items — urgency comes first.
- List today's meetings in chronological order by start time.
- Tone: professional and warm, like a trusted colleague. Direct and energizing. Never sycophantic.

JSON SCHEMA TO RETURN:
You must return a single valid JSON object matching this exact structure. No markdown, no code fences, no explanation — only the raw JSON object.

{
  "summary": "string — one sentence, maximum 20 words, energy-setting opening",
  "achievements": ["string — prose sentence describing something completed"],
  "pending": [
    {
      "id": "string",
      "title": "string",
      "type": "pr | issue | ticket",
      "repo": "string (optional)",
      "daysOpen": "number (optional)",
      "url": "string (optional)"
    }
  ],
  "blockers": [
    {
      "id": "string",
      "title": "string",
      "source": "github | jira",
      "urgency": "high | medium | low",
      "description": "string (optional, maximum 30 words, prose only)"
    }
  ],
  "todaySchedule": [
    {
      "id": "string",
      "title": "string",
      "start": "ISO 8601 datetime string",
      "end": "ISO 8601 datetime string",
      "attendees": "number",
      "isVideo": "boolean"
    }
  ],
  "teamAlerts": [
    {
      "type": "conflict | synergy | awareness",
      "message": "string — spoken-friendly alert text",
      "withMember": "string — first name only"
    }
  ],
  "wordCount": "number — total word count across summary, all achievement strings, all blocker descriptions, team alert messages, and any prose in pending titles"
}
${sourceNotesBlock}${teamAlertsBlock}
PERSONAL ACTIVITY DATA:
${JSON.stringify({ github, google, jira }, null, 2)}

Return ONLY the JSON object. Do not include any text before or after it. Do not wrap it in a code block or markdown fence.`

  return prompt
}

// ─── Overlap Analysis Prompt ──────────────────────────────────────────────────

export function buildOverlapAnalysisPrompt(
  summaries: {
    userId: string
    focusSummary: string
    prTitles: string[]
    ticketTitles: string[]
  }[]
): string {
  const summaryBlock = summaries
    .map((s) => {
      const lines: string[] = [`Member ID: ${s.userId}`]
      lines.push(`Focus: ${s.focusSummary}`)
      if (s.prTitles.length > 0) {
        lines.push(`Pull requests: ${s.prTitles.join(' | ')}`)
      }
      if (s.ticketTitles.length > 0) {
        lines.push(`Tickets: ${s.ticketTitles.join(' | ')}`)
      }
      return lines.join('\n')
    })
    .join('\n\n')

  return `You are analyzing work activity summaries from a software team.
Identify pairs of teammates who appear to be working on
semantically similar features or initiatives, even if in
different codebases or with different ticket numbers.

Be conservative — only flag genuine overlaps, not coincidental
use of common words. Return ONLY valid JSON.

Format: { "overlaps": [{ "memberIds": ["id1", "id2"], "reason": "string", "type": "synergy" | "awareness" }] }

Member summaries:
${summaryBlock}`
}

// ─── Focus Summary Prompt ─────────────────────────────────────────────────────

export function buildFocusSummaryPrompt(activity: {
  github: GitHubActivity | null
  google: GoogleActivity | null
  jira: JiraActivity | null
}): string {
  return `You are summarizing a software engineer's recent work activity into a single concise sentence.

The sentence should describe what they are currently focused on, like:
"Working on auth refactor and caching layer"
"Fixing payment webhook bugs and reviewing the onboarding pull request"
"Implementing the team dashboard and overlap detection feature"

Rules:
- Return exactly one sentence, no more than 20 words
- Use present continuous tense ("Working on...", "Fixing...", "Implementing...")
- Be specific — reference actual feature names, not generic descriptions
- Do not use the word "I" — write in third person implied (no subject)
- Return ONLY the sentence string, no JSON, no explanation, no punctuation at the end

Activity data:
${JSON.stringify(activity, null, 2)}`
}
