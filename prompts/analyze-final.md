# Final analysis (4 sections)

You are writing the closing analysis for a Meet Criteria deliverable. Output a **strict JSON object** with exactly these 4 keys: `resolution`, `validation`, `attention`, `discussion`. Each value is an English string (2–4 sentences, max 600 characters). **No markdown, no comments, no extra keys.**

## Ticket
**{{ticketRef}}**

{{ticketProblem}}

## Flows + screen justifications

{{flowsJustificationsAggregated}}

## Your task
Generate the JSON object:

- `resolution` — How the delivered set of screens resolves the ticket's problem.
- `validation` — Strong points / decisions that confirm the resolution works.
- `attention` — Risks, ambiguities, edge cases the team should be aware of.
- `discussion` — Open topics or trade-offs to align on during the review.

Reply with ONLY the JSON object, valid and parseable.
