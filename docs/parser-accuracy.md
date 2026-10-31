# Intake parser accuracy

Rule-based parser (the fallback used when Gemini is unavailable), measured on 60 messages in `backend/tests/data/parser_messages.json`.
A message counts as correct only if blood group, units, hospital and urgency are **all** right. Re-run with `pytest tests/test_parser.py -s`.

| Set | Messages | All fields correct | Accuracy |
|---|---|---|---|
| Development (used while building) | 40 | 40 | 100% |
| Holdout (kept aside) | 20 | 20 | 100% |

| Language | Messages | Accuracy |
|---|---|---|
| Bangla | 12 | 100% |
| English | 16 | 100% |
| Banglish | 32 | 100% |

| Field | Accuracy (all 60) |
|---|---|
| blood group | 100% |
| units | 100% |
| hospital | 100% |
| urgency | 100% |

## Limits

- The holdout set was written by the same team, so real-world messages will be messier. Collect real (anonymised) examples before claiming more.
- Hospitals must be on the known list or written with one of its aliases. Unknown hospitals are left for the requester to pick.
- Relative times ("kal", "aj raate") are read in Dhaka time. "kal" is always taken as tomorrow.
- Every parse is shown to the requester for confirmation before anything is sent, so a parser mistake cannot reach donors unchecked.
