---
name: end-session
description: Refresh and compress PROJECT_CONTEXT.md and add a new entry to SESSION_LOG.md at the end of a bank-payment-app thread. Use when Codex is wrapping up a session, preparing for a new thread, or explicitly asked to update project context and record session progress while removing stale, duplicated, speculative, or low-value details.
---

# End Session

## Overview

Use this skill only when explicitly asked to perform end-of-session cleanup for this project.
Its targets are `PROJECT_CONTEXT.md` and `SESSION_LOG.md`.

## Workflow

1. Read `PROJECT_CONTEXT.md`.
2. Read `SESSION_LOG.md`.
3. Review the current thread and recent repo state that materially changed product direction, implementation state, constraints, or open gaps.
4. Rewrite the existing sections in `PROJECT_CONTEXT.md` in place instead of appending blindly.
5. Keep only durable, next-session-useful information in `PROJECT_CONTEXT.md`:
   - product summary
   - current implementation state
   - agreed product direction
   - current business rules and constraints
   - known gaps/placeholders
   - practical testing notes
6. Remove anything that increases noise without helping the next thread:
   - duplicated statements
   - superseded decisions
   - rejected options
   - temporary troubleshooting notes
   - step-by-step historical narration
   - speculative ideas that were not agreed
7. Keep `PROJECT_CONTEXT.md` lean. Prefer one canonical statement over multiple similar bullets.
8. Add one new concise entry to `SESSION_LOG.md` for the session that just ended.
9. In the new session log entry, record only the main progress and decisions from that session.

## Editing Rules

- Prefer editing or replacing existing bullets over adding new sections.
- Keep sections short and factual.
- Distinguish clearly between:
  - implemented now
  - agreed but not yet implemented
  - current gaps
- If a new decision replaces an old one, delete the old wording rather than keeping both.
- Preserve wording only when it is still active and useful for the next session.
- For `SESSION_LOG.md`, append one concise new session entry instead of rewriting the whole file unless the file is clearly malformed.
- Keep the session log focused on what changed in that session, not full project restatement.

## Output Standard

- End with a concise `PROJECT_CONTEXT.md` that a future thread can read quickly.
- End with an updated `SESSION_LOG.md` that records the finished session in short plain English.
- Optimize for continuity, not completeness.
- When uncertain whether to keep a detail, keep it only if losing it would likely cause the next thread to make a wrong decision or repeat discovery work.
