# Pulse — Voice Steering v2
 
## Core Principle
Everything in Pulse that involves text generation must be written
with the assumption that it will be spoken aloud by ElevenLabs TTS.
Text that sounds great on screen often sounds terrible as audio.
Always optimize for the ear, not the eye.
 
---
 
## Gemini Output Rules for Spoken Text
 
When writing Gemini prompts that produce text destined for TTS,
always include this instruction block verbatim:
 
```
IMPORTANT: This text will be converted to speech by a TTS engine.
Format rules:
- Write in flowing prose only — no bullet points, no numbered lists, no markdown
- Spell out numbers under 10 ("three" not "3")
- Avoid abbreviations — write "pull request" not "PR", "Jira ticket" not "ticket key"
- Use natural spoken transitions between sections
- Do not use any markdown formatting whatsoever
- No em dashes, no parenthetical asides, no colons introducing lists
```
 
---
 
## General Text Rules for TTS
 
### Never use in briefing text
- Bullet points or dashes (`-`, `•`, `*`)
- Numbered lists (`1.`, `2.`)
- Markdown headers (`#`, `##`)
- Bold or italic markers (`**`, `_`)
- Em dashes (`—`) used as list separators
- Abbreviations that do not read naturally aloud
- Raw ticket keys like `PULSE-82` — say "Pulse eighty-two" instead
- Raw file paths like `src/lib/auth/` — say "the auth module" instead
- PR numbers like `#42` — say "pull request forty-two" instead
### Always use instead
- Full prose sentences with natural spoken transitions
  ("You also have...", "On top of that...", "Worth noting...", "Separately...")
- Spoken-friendly numbers ("three pull requests" not "3 PRs")
- Natural pauses via commas and periods
- Second person throughout ("you merged", "your PR", "your standup")
- First names only for teammates ("Ana" not "Ana Martinez")
---
 
## Word Count
 
- **Full briefing:** maximum 400 words (increased from 350 to accommodate team alerts)
- **Opening summary sentence:** maximum 20 words
- **Team alert per overlap:** maximum 35 words each
- **Individual blocker description:** maximum 30 words
---
 
## Team Alerts — Speech Order and Priority
 
When the briefing includes team overlap alerts, follow this order:
 
1. **Conflicts first** — always lead with conflicts, they require action
2. **Synergies second** — opportunities to collaborate
3. **Awareness last** — passive info, keep it brief
### Conflict speech pattern
Name the teammate first, then the overlap, then the implication:
 
```
"Ana is also modifying the auth module and has an open pull request
there. Your changes may conflict on merge — worth a quick message
before you push."
```
 
### Synergy speech pattern
Frame it as an opportunity, not a warning:
 
```
"Marcos is building a caching layer for the notifications service
while you just finished yours. You might save each other some time
by comparing approaches."
```
 
### Awareness speech pattern
Keep it to one sentence, no call to action needed:
 
```
"Lucía also committed to pulse-app yesterday, working on the
dashboard components — no overlap with your files."
```
 
---
 
## Tone Guidelines
 
- **Professional but warm** — trusted colleague, not a corporate assistant
- **Direct** — lead with what matters most
- **Energizing** — opening sentence sets a realistic but positive tone
- **Never sycophantic** — no "Great job!", no "Amazing work!"
- **Confident** — state facts, don't hedge with "it seems like" or "possibly"
---
 
## ElevenLabs Configuration
 
### TTS (Briefing audio)
- **Model:** `eleven_turbo_v2`
- **Voice ID:** `process.env.ELEVENLABS_VOICE_ID` — the "Pulse" custom voice
- **Output format:** `mp3_44100_128`
- **Stability:** `0.5`
- **Similarity boost:** `0.75`
### Conversational AI (Assistant)
- **Model:** `eleven_turbo_v2`
- **Same voice ID as TTS** — consistent "Pulse" persona across both modes
- **Session timeout:** 5 minutes of inactivity
- **Turn detection:** server-side VAD
- **Opening line:** always reference something specific from the user's data,
  never a generic greeting
---
 
## Audio File Handling
- All MP3 files stored in Vercel Blob
- Blob URLs saved in Vercel KV alongside briefing content
- Blob naming: `briefings/{userId}/{YYYY-MM-DD}.mp3`
- Never regenerate audio if a valid cached version exists for today
---
 
## Transcript Display
- Transcript shown in UI is the raw Gemini text output
- Not reformatted for display — prose that works for TTS is readable enough
- Toggle shows/hides the panel — no word-level sync for MVP