# Demo script (about 8 minutes)

Before the demo: run the backend with `SECONDS_PER_MINUTE=3`, run `python -m app.seed`, and open two browser windows: one as `requester@demo.roktodoot.org` on a phone-sized window, one as admin.

1. **The problem.** Show a typical Facebook-style post: unstructured, unverified, no follow-up.
2. **Donors.** Register one donor live on `/donor` (tap the map, give consent). Mention the 200 seeded donors.
3. **Banglish request.** On the home page type `Dhaka Medical e O+ lagbe, 2 bag, aj raate`. Show the parsed details and confirm.
4. **Trust.** Show the trust score in the timeline. Submit the same request again: it is held. In the admin window, show the held request, its score breakdown and the reason, then reject it.
5. **Ranked donors and wave 1.** Open the admin audit log for the first request and show the ranked donors with their score parts.
6. **Escalation.** Watch the countdown. When wave 1 times out (about 15 s for a critical request), the map widens to 10 km and the ring moves outward. Use "Demo: end wave now" to move faster if needed.
7. **Acceptance.** Log in as a contacted donor (or use "Demo: a donor accepts"). The requester's page shows the donor's phone number. Tap "Blood received" and show the donor's cooldown starting on their profile.
8. **Audit and analytics.** Show the full audit log and the admin statistics.

Close by pointing out that the LLM only reads language. Every decision about who to contact and when comes from rules that are tested.
