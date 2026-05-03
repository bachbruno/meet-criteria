# Gap check vs ticket

You are comparing what the ticket asks for against what the delivered screens actually show. Output a **strict JSON object** with these keys:

```json
{
  "summary": "<one English sentence introducing the result>",
  "gaps": [
    { "kind": "missing|ambiguous|extra", "ticketAspect": "<what the ticket asks>", "evidence": "<what the screens show or fail to show>" }
  ]
}
```

If no gaps, return `{ "summary": "All ticket aspects appear in the delivery.", "gaps": [] }`.

## Gap kinds
- `missing` — ticket asks for X, no screen shows it.
- `ambiguous` — ticket is vague about X; the screens commit to one interpretation but don't exhaust the alternatives.
- `extra` — screens show something outside the ticket scope (informational only, not a defect).

## Ticket
**{{ticketRef}}**

{{ticketProblem}}

## Flows + screen justifications

{{flowsJustificationsAggregated}}

Reply with ONLY the JSON object, valid and parseable. **No markdown, no extra keys.**
