# Pulse — Voice Steering

## Core Principle
Everything in Pulse that involves text generation must be written
with the assumption that it will be spoken aloud by ElevenLabs TTS.
Text that sounds great on screen often sounds terrible as audio.
Always optimize for the ear, not the eye.

## Gemini Output Rules

### Never use these in briefing text
- Bullet points or dashes (`-`, `•`, `*`)
- Numbered lists (`1.`, `2.`)
- Markdown headers (`#`, `##`)
- Bold or italic markers (`**`, `_`)
- Parenthetical asides with heavy punctuation
- Em dashes (`—`) used for lists
- Abbreviations that don't read naturally (use "pull request" not "PR" in spoken text)

### Always use instead
- Full prose sentences connected with natural transitions
  ("You also have...", "On top of that...", "Worth noting...")
- Spoken-friendly numbers ("three pull requests" not "3 PRs")
- Natural pauses via commas and periods, not line breaks
- Second person throughout ("you merged", "your standup", "you have")

### Word count
- Briefing content: maximum 350 words
- Opening summary sentence: maximum 20 words
- Individual blocker descriptions: maximum 30 words each

### Tone
- Professional but warm — like a trusted colleague, not a corporate bot
- Direct — lead with what matters (blockers first, then achievements)
- Energizing — the opening sentence should set a positive but realistic tone
- Never sycophantic ("Great job!", "Amazing work!") — just factual and clear

## ElevenLabs Configuration

### TTS (Briefing audio)
- **Model:** `eleven_turbo_v2` — faster generation, sufficient quality for briefings
- **Voice ID:** Read from `ELEVENLABS_VOICE_ID` env var (the "Pulse" custom voice)
- **Output format:** `mp3_44100_128` — good quality, reasonable file size
- **Stability:** `0.5` — balanced between consistency and naturalness
- **Similarity boost:** `0.75` — keeps voice close to the reference

### Conversational AI (Assistant)
- **Model:** `eleven_turbo_v2`
- **Same voice as TTS** — the "Pulse" persona is consistent across both modes
- **Session timeout:** 5 minutes of inactivity
- **Turn detection:** server-side VAD (voice activity detection)
- **First message:** Agent greets the user by referencing something
  specific from their briefing (not a generic "How can I help?")

## Prompt Engineering for Voice

When writing Gemini prompts that produce spoken text, always include
this instruction block:

```
IMPORTANT: This text will be converted to speech by a TTS engine.
Format rules:
- Write in flowing prose only, no lists or bullet points
- Spell out numbers under 10 ("three" not "3")
- Avoid abbreviations — write "pull request" not "PR"
- Use natural spoken transitions between sections
- Do not use any markdown formatting
```

## Audio File Handling
- All generated MP3 files are stored in Vercel Blob
- Blob URLs are saved in Vercel KV alongside the briefing content
- Audio files are pre-generated before the user's scheduled briefing time
- Never regenerate audio if a valid cached version exists for today
- Blob file naming: `briefings/{userId}/{YYYY-MM-DD}.mp3`

## Transcript Sync
- The transcript displayed in the UI is the raw Gemini text output
- It is NOT re-processed or reformatted for display
- The transcript toggle shows/hides the text — no synchronized highlighting for MVP
- Transcript text may contain punctuation that aids TTS but looks slightly formal on screen
  — this is acceptable for MVP