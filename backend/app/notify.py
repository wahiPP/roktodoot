"""Notifications: in-app (database), email via Resend when configured, SMS mocked."""

import logging

import httpx
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Notification, User

log = logging.getLogger("roktodoot.notify")

# Bangla and English templates (Follow-up agent and status updates).
TEMPLATES = {
    "donor_request": {
        "en": "Urgent: {blood_group} blood needed at {hospital} ({distance_km} km away). Can you help?",
        "bn": "জরুরি: {hospital}-এ {blood_group} রক্ত প্রয়োজন ({distance_km} কিমি দূরে)। আপনি কি সাহায্য করতে পারবেন?",
    },
    "status_change": {
        "en": "Your request #{request_id} is now {status}.",
        "bn": "আপনার অনুরোধ #{request_id} এখন {status}।",
    },
    "donor_accepted": {
        "en": "A donor accepted! Contact: {donor_phone}.",
        "bn": "একজন রক্তদাতা রাজি হয়েছেন! যোগাযোগ: {donor_phone}।",
    },
    "thanks": {
        "en": "Thank you for donating blood. You helped save a life.",
        "bn": "রক্তদানের জন্য ধন্যবাদ। আপনি একটি জীবন বাঁচাতে সাহায্য করেছেন।",
    },
    "eligible_again": {
        "en": "Your rest period is over. You can donate blood again.",
        "bn": "আপনার বিশ্রামের সময় শেষ। আপনি আবার রক্ত দিতে পারবেন।",
    },
    "request_rejected": {
        "en": "Your request #{request_id} could not be published: {reason}",
        "bn": "আপনার অনুরোধ #{request_id} প্রকাশ করা যায়নি: {reason}",
    },
    "bank_fallback": {
        "en": "No donor has accepted request #{request_id} yet. Blood banks have been listed.",
        "bn": "অনুরোধ #{request_id}-এ এখনো কোনো রক্তদাতা রাজি হননি। ব্লাড ব্যাংকের তালিকা দেখানো হয়েছে।",
    },
}


def render(type_: str, **kw) -> dict:
    t = TEMPLATES.get(type_)
    if not t:
        return {"en": type_, "bn": type_}
    out = {}
    for lang, text in t.items():
        try:
            out[lang] = text.format(**kw)
        except KeyError:
            out[lang] = text
    return out


def notify(db: Session, user: User, type_: str, email: bool = False, sms: bool = False, **data) -> Notification:
    text = render(type_, **data)
    n = Notification(user_id=user.id, type=type_, payload={**data, "text": text})
    db.add(n)
    if email:
        send_email(user.email, f"RoktoDoot: {type_.replace('_', ' ')}", text["en"] + "\n\n" + text["bn"])
    if sms and user.phone:
        log.info("[SMS mock] to %s: %s", user.phone, text["en"])
    return n


def send_email(to: str, subject: str, body: str) -> None:
    s = get_settings()
    if not s.resend_api_key or s.env == "test":
        log.info("[email mock] to %s: %s", to, subject)
        return
    try:
        httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {s.resend_api_key}"},
            json={"from": s.email_from, "to": [to], "subject": subject, "text": body},
            timeout=5,
        )
    except httpx.HTTPError as e:  # never let email failure break the flow
        log.warning("Email send failed: %s", e)
