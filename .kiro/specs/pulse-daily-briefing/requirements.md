# Requirements Document

## Introduction

Pulse is a voice-first team intelligence tool that aggregates work activity from GitHub, Google Calendar, and Jira across all team members to generate a personalized daily audio briefing for each user, detect overlapping work and potential conflicts across the team, and allow any team member to ask an AI voice assistant about what others are working on.

The goal is to eliminate unnecessary interruptions, duplicate work, and merge conflicts — without requiring anyone to write a single status update.

The system is a web application built on Next.js 14. All third-party API calls (GitHub, Google Calendar, Jira, Gemini, ElevenLabs) are made server-side via Next.js API routes. OAuth tokens are never exposed to the client.

---

## Glossary

- **Pulse**: The overall system and product name.
- **Briefing**: The structured daily summary produced by aggregating data sources and generating text via Gemini API, then converting to audio via ElevenLabs TTS.
- **Briefing_Generator**: The server-side component responsible for orchestrating data aggregation, Gemini text generation, and ElevenLabs audio synthesis.
- **Data_Aggregator**: The server-side component that fetches activity from connected data sources (GitHub, Google Calendar, Jira) for one or more team members.
- **Auth_Manager**: The component responsible for OAuth 2.0 flows, token storage, and token refresh.
- **Scheduler**: The component responsible for triggering briefing pre-generation at the user's configured time.
- **Audio_Player**: The client-side UI component that plays the MP3 briefing and displays the transcript.
- **Voice_Assistant**: The ElevenLabs Conversational AI session loaded with today's briefing context and full team activity data.
- **Transcript**: The full text of the briefing, displayed when the user activates the transcript toggle.
- **Data_Source**: Any connected external service — GitHub, Google Calendar, or Jira.
- **OAuth_Token**: An access token obtained via OAuth 2.0, stored encrypted server-side.
- **Sprint**: An active Jira sprint associated with the user's connected Jira project.
- **Blocker**: A Jira ticket explicitly flagged as blocking progress in the current Sprint.
- **Team**: A group of 2 to 25 users sharing a Pulse workspace for team intelligence features.
- **Team_Member**: A user who belongs to a Team and has connected at least one Data_Source.
- **Overlap**: A detected condition where two or more Team_Members are working on related code, tickets, or features.
- **Overlap_Detector**: The server-side component that identifies structural and semantic overlaps across team member activity.
- **Team_Dashboard**: The UI view showing each member's current focus, active overlaps, and shared meeting timeline.

---

## Requirements

### Requirement 1: First-Time Onboarding

**User Story:** As a new user, I want to be guided through connecting my data sources and joining a team, so that Pulse can generate a personalized briefing and surface team intelligence for me.

#### Acceptance Criteria

1. WHEN a user visits Pulse for the first time, THE Pulse SHALL present an onboarding flow that prompts the user to connect at least one Data_Source (GitHub or Google Calendar).
2. WHEN a user connects a Data_Source, THE Auth_Manager SHALL authenticate via OAuth 2.0 and store the resulting OAuth_Token in an encrypted server-side session.
3. WHEN a user completes connecting their Data_Sources, THE Pulse SHALL prompt the user to create or join a Team before accessing the dashboard.
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

### Requirement 3: Team Creation and Joining

**User Story:** As a user, I want to create or join a team, so that Pulse can surface team-wide intelligence alongside my personal briefing.

#### Acceptance Criteria

1. WHEN a user creates a Team, THE Pulse SHALL generate a unique invite link valid for 72 hours.
2. WHEN a user joins via an invite link, THE Pulse SHALL add them to the Team and prompt them to connect their Data_Sources.
3. THE Pulse SHALL support Teams of 2 to 25 members.

---

### Requirement 4: Team Member Connection Status

**User Story:** As a team member, I want to see which of my teammates have connected their data sources, so that I understand the completeness of team intelligence.

#### Acceptance Criteria

1. THE Pulse SHALL display each Team_Member's connection status (GitHub connected, Google connected, Jira connected) in the team settings view.
2. WHEN a Team_Member connects GitHub, THE Data_Aggregator SHALL identify which repositories they have access to and store this for overlap detection.

---

### Requirement 5: Individual Data Aggregation

**User Story:** As a user, I want Pulse to pull my recent activity from all connected sources, so that my briefing reflects everything I worked on and what needs my attention.

#### Acceptance Criteria

1. WHEN the daily briefing is triggered for a user, THE Data_Aggregator SHALL fetch that user's activity from the last 24 hours, including: GitHub commits, open pull requests, pending reviews, closed issues, and modified files; Google Calendar events for today including titles and times; and Jira tickets in progress, moved tickets, and flagged blockers.
2. IF a Data_Source is unavailable or returns an error, THEN THE Briefing_Generator SHALL generate the Briefing using data from the remaining available sources and notify the user which source failed.
3. THE Data_Aggregator SHALL store the list of files and modules modified by each Team_Member in the last 24 hours for use by the Overlap_Detector.

---

### Requirement 6: Team Activity Aggregation

**User Story:** As a team member, I want Pulse to continuously aggregate my teammates' activity, so that the team intelligence view and voice assistant always reflect current work.

#### Acceptance Criteria

1. THE Data_Aggregator SHALL aggregate activity across all connected Team_Members every 60 minutes during working hours (6am to 10pm local team time).
2. FOR EACH Team_Member, THE Data_Aggregator SHALL build a summary of: which repositories they committed to, which files or directories they modified, which Jira tickets they are working on, and which features or areas their pull request titles suggest they are building.
3. THE Pulse SHALL make team activity queryable by the Voice_Assistant so any Team_Member can ask what others are working on.

---

### Requirement 7: Overlap and Conflict Detection

**User Story:** As a developer, I want Pulse to detect when I am working on the same code or features as a teammate, so that I can avoid merge conflicts and coordinate proactively.

#### Acceptance Criteria

1. THE Overlap_Detector SHALL detect an Overlap when two or more Team_Members meet any of the following conditions in the last 24 hours: committed to the same repository, modified files in the same directory path, have open pull requests touching the same files, are assigned to Jira tickets in the same epic or component, or have pull request titles or ticket descriptions with high semantic similarity.
2. WHEN an Overlap is detected, THE Overlap_Detector SHALL classify it as one of: CONFLICT (same file modified by two people with open pull requests), SYNERGY (similar feature area where collaboration would be beneficial), or AWARENESS (same repository, low risk but worth knowing).
3. WHEN a CONFLICT Overlap is detected, THE Briefing_Generator SHALL include it prominently in both affected users' personal Briefings.
4. WHEN a SYNERGY Overlap is detected, THE Briefing_Generator SHALL suggest in the Briefing that the two members might benefit from a quick sync.
5. THE Pulse SHALL surface Overlaps in the Team_Dashboard as a dedicated section visible to all Team_Members.

---

### Requirement 8: Personal Briefing Generation

**User Story:** As a user, I want a concise, conversational summary of my day that includes relevant team context, so that I can absorb everything I need to know without reading raw data.

#### Acceptance Criteria

1. WHEN all data has been aggregated, THE Briefing_Generator SHALL send the user's personal activity plus relevant team Overlaps to the Gemini API to produce a Briefing containing: a personal summary of achievements, pending items, and blockers; today's schedule; and team Overlaps that affect this user specifically.
2. THE Briefing_Generator SHALL instruct Gemini to keep the Briefing under 400 words, use conversational spoken language, and prioritize conflicts over synergies over awareness items.
3. IF the Gemini API returns an error, THEN THE Briefing_Generator SHALL retry the request once and, if the retry fails, surface an error to the user explaining that the Briefing could not be generated.

---

### Requirement 9: Audio Synthesis

**User Story:** As a user, I want my briefing delivered as natural-sounding speech, so that I can listen to it hands-free while getting ready in the morning.

#### Acceptance Criteria

1. WHEN the structured Briefing text is ready, THE Briefing_Generator SHALL send it to the ElevenLabs TTS API and receive an audio file in MP3 format.
2. THE Briefing_Generator SHALL use a consistent ElevenLabs voice configuration named "Pulse" across all audio Briefings for all Team_Members.
3. IF the ElevenLabs TTS API returns an error, THEN THE Briefing_Generator SHALL retry the request once and, if the retry fails, surface an error to the user explaining that audio generation failed while making the text Transcript available.

---

### Requirement 10: Audio Playback

**User Story:** As a user, I want a simple audio player with playback controls, so that I can listen to my briefing at my own pace.

#### Acceptance Criteria

1. WHEN the audio Briefing is ready, THE Audio_Player SHALL display a playback interface containing: a play/pause control, a progress bar showing elapsed and total time, a playback speed selector with options 1x, 1.5x, and 2x, and a transcript toggle button.
2. WHEN the user activates the transcript toggle, THE Audio_Player SHALL display the full Transcript of the Briefing.
3. THE Pulse SHALL be fully functional on mobile browsers with touch-optimized audio controls.
4. THE Pulse SHALL function on current versions of Chrome, Firefox, and Safari without requiring a native application install.

---

### Requirement 11: Voice Assistant — Team Intelligence

**User Story:** As a team member, I want to ask a voice assistant about my own work and my teammates' work, so that I can get specific answers without navigating through multiple tools.

#### Acceptance Criteria

1. WHEN the user activates the Voice_Assistant, THE Voice_Assistant SHALL load a context window containing: the user's full personal Briefing, all Team_Members' activity summaries for today, and all detected Overlaps and their classifications.
2. WHILE a voice session is active, THE Voice_Assistant SHALL accept natural-language questions about the user's own work, including questions such as: "Which of my pull requests has been waiting longest?", "What meetings do I have after lunch?", and "What is blocking me today?"
3. WHILE a voice session is active, THE Voice_Assistant SHALL accept natural-language questions about teammates' work, including questions such as: "What is Ana working on today?", "Who else is touching the auth module?", "Is anyone working on something similar to my caching pull request?", and "Who on the team knows most about the payments service?"
4. WHEN the user asks about a teammate, THE Voice_Assistant SHALL answer based only on that teammate's aggregated activity data and SHALL NOT fabricate or infer beyond what was observed.
5. WHEN the voice session ends, THE Voice_Assistant SHALL display a text summary of the questions asked and answers given during the session.
6. IF the ElevenLabs Conversational AI session fails to initialize, THEN THE Voice_Assistant SHALL display an error message and offer the user the option to retry.

---

### Requirement 12: Team Dashboard View

**User Story:** As a team member, I want a shared view of what everyone is working on, so that I can stay aware of team activity without interrupting my colleagues.

#### Acceptance Criteria

1. THE Pulse SHALL provide a Team_Dashboard showing: each Team_Member's current focus area derived from recent activity, active Overlaps grouped by type (conflict, synergy, awareness), and a shared timeline of today's team meetings.
2. WHEN a Team_Member has no activity in the last 24 hours, THE Pulse SHALL show them as "No recent activity" without exposing the absence as a negative signal.
3. THE Pulse SHALL NOT show raw commit messages, file paths, or ticket details of other Team_Members in the UI — only derived summaries, to protect individual privacy within the team.

---

### Requirement 13: Briefing Schedule

**User Story:** As a user, I want to receive my briefing at a time that fits my morning routine, so that it's ready when I need it.

#### Acceptance Criteria

1. WHEN a user completes onboarding, THE Pulse SHALL ask for their preferred briefing time with a default of 08:00 in their local timezone.
2. THE Scheduler SHALL pre-generate the Briefing 5 minutes before the user's scheduled briefing time so that it is available instantly when the user opens the application.
3. IF the pre-generation job fails, THEN THE Scheduler SHALL log the failure and trigger an on-demand generation when the user opens the application, notifying the user of the delay.

---

### Requirement 14: Performance

**User Story:** As a user, I want my briefing to be generated quickly, so that I'm not waiting around on a slow loading screen.

#### Acceptance Criteria

1. THE Briefing_Generator SHALL complete the full briefing pipeline — data aggregation, Gemini text generation, and ElevenLabs audio synthesis — within 45 seconds under normal operating conditions.

---

### Requirement 15: Data Privacy and Scoping

**User Story:** As a team member, I want my work data to stay within my team, so that it is never visible to people outside my team.

#### Acceptance Criteria

1. THE Pulse SHALL scope all team activity data strictly to the Team — no Team_Member's data SHALL be visible outside their Team.
2. THE Auth_Manager SHALL ensure OAuth_Tokens are never exposed to the client in any HTTP response, page prop, or error payload.

---

## Correctness Properties

The following properties describe invariants and round-trip behaviors that acceptance tests should verify.

### CP-1: Partial Failure Invariant
For any combination of Data_Source availability (all available, one unavailable, two unavailable), the Briefing_Generator SHALL produce a Briefing object. The Briefing SHALL contain a non-empty summary section regardless of which sources failed. The set of failure notifications in the Briefing SHALL exactly match the set of sources that returned errors.

### CP-2: Briefing Word Count Invariant
For all generated Briefings, the word count of the structured text returned by Gemini SHALL be less than or equal to 400 words. This property should hold across varied input sizes (minimal activity, heavy activity, all sources populated, multiple team overlaps included).

### CP-3: Audio Round-Trip
WHEN a Briefing text is sent to ElevenLabs and an MP3 is returned, the MP3 SHALL be a valid audio file that can be decoded and played. The duration of the audio SHALL be greater than zero seconds. (Non-strict round-trip: text → audio → playable.)

### CP-4: Scheduled Time Invariant
For any user-configured briefing time T, the Scheduler SHALL trigger pre-generation at time T − 5 minutes. The pre-generation timestamp recorded SHALL always be earlier than or equal to T.

### CP-5: Token Isolation Property
For all requests processed by the system, no HTTP response sent to the browser client SHALL contain an OAuth_Token value. This property must hold across all API route responses, page props, and error payloads.

### CP-6: Voice Session Context Completeness
WHEN a Voice_Assistant session is initialized, the context payload sent to ElevenLabs Conversational AI SHALL contain the complete Briefing text from the same calendar day, all Team_Member activity summaries, and all detected Overlaps. The context SHALL not be empty or truncated.

### CP-7: Overlap Classification Exhaustiveness
For every pair of Team_Members where an Overlap is detected, the Overlap_Detector SHALL assign exactly one classification (CONFLICT, SYNERGY, or AWARENESS). No Overlap SHALL be left unclassified.

### CP-8: Team Data Scoping Invariant
For any query to the team activity cache, the data returned SHALL contain only records belonging to the requesting user's Team. No record from a different Team SHALL appear in any response.

---

## Out of Scope (MVP)

- Slack or Linear integrations
- Native mobile application
- Briefing history retention beyond 7 days
- Multiple teams per user
- Admin roles or permissions within a team
- Real-time activity streaming (60-minute polling is sufficient)
