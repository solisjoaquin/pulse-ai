# Requirements Document

## Introduction

Pulse is a voice-first daily briefing tool that aggregates activity from GitHub, Google Calendar, and Jira to generate a personalized 2–3 minute audio summary each morning. It replaces the need for synchronous daily standups by delivering a spoken briefing — and an interactive voice assistant — that surfaces commits, pull requests, calendar events, and sprint blockers in a single, hands-free experience.

The system is a web application built on Next.js. All third-party API calls (GitHub, Google Calendar, Jira, Gemini, ElevenLabs) are made server-side. OAuth tokens are never exposed to the client.

---

## Glossary

- **Pulse**: The overall system and product name.
- **Briefing**: The structured daily summary produced by aggregating data sources and generating text via Gemini, then converting to audio via ElevenLabs.
- **Briefing_Generator**: The server-side component responsible for orchestrating data aggregation, Gemini text generation, and ElevenLabs audio synthesis.
- **Data_Aggregator**: The server-side component that fetches activity from connected data sources (GitHub, Google Calendar, Jira).
- **Auth_Manager**: The component responsible for OAuth 2.0 flows, token storage, and token refresh.
- **Scheduler**: The component responsible for triggering briefing pre-generation at the user's configured time.
- **Audio_Player**: The client-side UI component that plays the MP3 briefing and displays the transcript.
- **Voice_Assistant**: The ElevenLabs Conversational AI session loaded with today's briefing context.
- **Transcript**: The full text of the briefing, displayed in sync with audio playback.
- **Data_Source**: Any connected external service — GitHub, Google Calendar, or Jira.
- **OAuth_Token**: An access token obtained via OAuth 2.0, stored encrypted server-side.
- **Sprint**: An active Jira sprint associated with the user's connected Jira project.
- **Blocker**: A Jira ticket explicitly flagged as blocking progress in the current Sprint.

---

## Requirements

### Requirement 1: First-Time Onboarding

**User Story:** As a new user, I want to be guided through connecting my data sources, so that Pulse can generate a personalized briefing for me.

#### Acceptance Criteria

1. WHEN a user visits Pulse for the first time, THE Pulse SHALL present an onboarding flow that prompts the user to connect at least one Data_Source (GitHub or Google Calendar).
2. WHEN a user connects a Data_Source, THE Auth_Manager SHALL authenticate via OAuth 2.0 and store the resulting OAuth_Token in an encrypted server-side session.
3. WHEN a user has successfully completed onboarding, THE Pulse SHALL redirect the user to the main dashboard.
4. IF a user attempts to complete onboarding without connecting at least one Data_Source, THEN THE Pulse SHALL display an error message and prevent progression past the onboarding step.

---

### Requirement 2: OAuth Token Security

**User Story:** As a user, I want my credentials to be handled securely, so that my accounts are not exposed to third parties or client-side code.

#### Acceptance Criteria

1. THE Auth_Manager SHALL store all OAuth_Tokens exclusively server-side in an encrypted session store.
2. THE Pulse SHALL make all API calls to third-party services (GitHub, Google Calendar, Jira, Gemini, ElevenLabs) via Next.js API routes, never from the client.
3. IF an OAuth_Token expires, THEN THE Auth_Manager SHALL attempt a token refresh before retrying the failed request.
4. THE Auth_Manager SHALL never transmit an OAuth_Token value to the browser client.

---

### Requirement 3: GitHub Data Aggregation

**User Story:** As a developer, I want Pulse to pull my recent GitHub activity, so that my briefing reflects what I worked on and what needs my attention.

#### Acceptance Criteria

1. WHEN the daily briefing is triggered, THE Data_Aggregator SHALL fetch the authenticated user's GitHub activity from the last 24 hours, including: commits authored, pull requests opened or updated, pull requests pending the user's review, and issues closed.
2. IF the GitHub API is unavailable or returns an error, THEN THE Data_Aggregator SHALL record the failure, proceed with available data from other sources, and include a notification in the Briefing that GitHub data is missing.

---

### Requirement 4: Google Calendar Data Aggregation

**User Story:** As a user, I want my calendar events included in my briefing, so that I know what meetings I have today without opening my calendar.

#### Acceptance Criteria

1. WHEN the daily briefing is triggered, THE Data_Aggregator SHALL fetch all Google Calendar events for the current calendar day, including event titles, start and end times, and attendee lists.
2. IF the Google Calendar API is unavailable or returns an error, THEN THE Data_Aggregator SHALL record the failure, proceed with available data from other sources, and include a notification in the Briefing that calendar data is missing.

---

### Requirement 5: Jira Data Aggregation

**User Story:** As a developer, I want my Jira sprint status included in my briefing, so that I can stay on top of blockers and ticket progress without opening Jira.

#### Acceptance Criteria

1. WHERE Jira is connected as a Data_Source, THE Data_Aggregator SHALL fetch: tickets currently in progress assigned to the user, tickets whose status changed in the last 24 hours, and any Blockers flagged in the current Sprint.
2. IF the Jira API is unavailable or returns an error, THEN THE Data_Aggregator SHALL record the failure, proceed with available data from other sources, and include a notification in the Briefing that Jira data is missing.

---

### Requirement 6: Briefing Text Generation

**User Story:** As a user, I want a concise, conversational summary of my day, so that I can absorb it quickly without reading raw data.

#### Acceptance Criteria

1. WHEN all available data has been aggregated, THE Briefing_Generator SHALL send the aggregated data to the Gemini API to produce a structured briefing containing the following sections: summary, achievements, pending items, blockers, and today's schedule.
2. THE Briefing_Generator SHALL instruct Gemini to produce a briefing of no more than 350 words.
3. THE Briefing_Generator SHALL instruct Gemini to use conversational language and to prioritize Blockers and overdue items in the briefing narrative.
4. IF the Gemini API returns an error, THEN THE Briefing_Generator SHALL retry the request once and, if the retry fails, surface an error to the user explaining that the briefing could not be generated.

---

### Requirement 7: Audio Synthesis

**User Story:** As a user, I want my briefing delivered as natural-sounding speech, so that I can listen to it hands-free while getting ready in the morning.

#### Acceptance Criteria

1. WHEN the structured briefing text is ready, THE Briefing_Generator SHALL send it to the ElevenLabs TTS API and receive an audio file in MP3 format.
2. THE Briefing_Generator SHALL use a consistent ElevenLabs voice configuration named "Pulse" for all audio briefings.
3. IF the ElevenLabs TTS API returns an error, THEN THE Briefing_Generator SHALL retry the request once and, if the retry fails, surface an error to the user explaining that audio generation failed while making the text transcript available.

---

### Requirement 8: Audio Playback

**User Story:** As a user, I want a simple audio player with playback controls, so that I can listen to my briefing at my own pace.

#### Acceptance Criteria

1. WHEN the audio briefing is ready, THE Audio_Player SHALL display a playback interface containing: a play/pause control, a progress bar showing elapsed and total time, a playback speed selector with options 1x, 1.5x, and 2x, and a transcript toggle button.
2. WHEN the user activates the transcript toggle, THE Audio_Player SHALL display the full Transcript of the briefing.
3. THE Pulse SHALL be fully functional on mobile browsers with touch-optimized audio controls.
4. THE Pulse SHALL function on current versions of Chrome, Firefox, and Safari without requiring a native application install.

---

### Requirement 9: Voice Assistant

**User Story:** As a user, I want to ask follow-up questions about my briefing by voice, so that I can get specific answers without navigating through multiple tools.

#### Acceptance Criteria

1. WHEN the user activates the "Ask Pulse" control, THE Voice_Assistant SHALL initiate an ElevenLabs Conversational AI session with the full text of today's Briefing pre-loaded as context.
2. WHILE a voice session is active, THE Voice_Assistant SHALL accept natural-language questions about the briefing content, including questions such as: "Which PR has been waiting longest?", "What meetings do I have after lunch?", and "Who should I unblock today?"
3. WHEN the voice session ends, THE Voice_Assistant SHALL display a text summary of the questions asked and the answers given during the session.
4. IF the ElevenLabs Conversational AI session fails to initialize, THEN THE Voice_Assistant SHALL display an error message and offer the user the option to retry.

---

### Requirement 10: Briefing Schedule

**User Story:** As a user, I want to receive my briefing at a time that fits my morning routine, so that it's ready when I need it.

#### Acceptance Criteria

1. WHEN a user completes onboarding, THE Pulse SHALL prompt the user to select a preferred daily briefing time, with a default of 08:00 in the user's local timezone.
2. THE Scheduler SHALL pre-generate the Briefing 5 minutes before the user's scheduled briefing time so that it is available instantly when the user opens the application.
3. IF the pre-generation job fails, THEN THE Scheduler SHALL log the failure and trigger an on-demand generation when the user opens the application, notifying the user of the delay.

---

### Requirement 11: Partial Data Source Failure Handling

**User Story:** As a user, I want to receive a briefing even when one of my data sources is temporarily unavailable, so that a single outage doesn't block my morning routine.

#### Acceptance Criteria

1. IF one or more Data_Sources are unavailable when the briefing is triggered, THEN THE Briefing_Generator SHALL generate the Briefing using data from the remaining available sources.
2. WHEN a Briefing is generated with one or more missing Data_Sources, THE Pulse SHALL display a notification identifying which Data_Sources failed to load.
3. THE Briefing_Generator SHALL include a note within the Briefing text indicating which data is absent, so the spoken summary accurately reflects its own completeness.

---

### Requirement 12: Performance

**User Story:** As a user, I want my briefing to be generated quickly, so that I'm not waiting around on a slow loading screen.

#### Acceptance Criteria

1. THE Briefing_Generator SHALL complete the full briefing pipeline — data aggregation, Gemini text generation, and ElevenLabs audio synthesis — within 30 seconds under normal operating conditions.

---

## Correctness Properties

The following properties describe invariants and round-trip behaviors that acceptance tests should verify.

### CP-1: Partial Failure Invariant
For any combination of Data_Source availability (all available, one unavailable, two unavailable), the Briefing_Generator SHALL produce a Briefing object. The Briefing SHALL contain a non-empty summary section regardless of which sources failed. The set of failure notifications in the Briefing SHALL exactly match the set of sources that returned errors.

### CP-2: Briefing Word Count Invariant
For all generated Briefings, the word count of the structured text returned by Gemini SHALL be less than or equal to 350 words. This property should hold across varied input sizes (minimal activity, heavy activity, all sources populated).

### CP-3: Audio Round-Trip
WHEN a Briefing text is sent to ElevenLabs and an MP3 is returned, the MP3 SHALL be a valid audio file that can be decoded and played. The duration of the audio SHALL be greater than zero seconds. (Non-strict round-trip: text → audio → playable.)

### CP-4: Scheduled Time Invariant
For any user-configured briefing time T, the Scheduler SHALL trigger pre-generation at time T − 5 minutes. The pre-generation timestamp recorded SHALL always be earlier than or equal to T.

### CP-5: Token Isolation Property
For all requests processed by the system, no HTTP response sent to the browser client SHALL contain an OAuth_Token value. This property must hold across all API route responses, page props, and error payloads.

### CP-6: Voice Session Context Completeness
WHEN a Voice_Assistant session is initialized, the context payload sent to ElevenLabs Conversational AI SHALL contain the complete Briefing text from the same calendar day. The context SHALL not be empty or truncated.

---

## Out of Scope (MVP)

- Team or multi-user features
- Slack or Linear integrations
- Native mobile application
- Briefing history retention beyond 7 days
