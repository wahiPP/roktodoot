"""Seed a simulated Dhaka dataset: hospitals, blood banks and 200 donors.

All people, phone numbers and blood banks here are simulated (SRS 9.4).
Coordinates are approximate. Run:  python -m app.seed
"""

import random
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import db as dbmod
from .models import BloodBank, DonorProfile, Hospital, User

HOSPITALS = [
    (
        "Dhaka Medical College Hospital",
        ["dmch", "dhaka medical", "dhaka medical college", "ঢাকা মেডিকেল", "ঢামেক"],
        23.7256,
        90.3976,
    ),
    (
        "Bangabandhu Sheikh Mujib Medical University (PG)",
        ["bsmmu", "pg hospital", "pg", "পিজি", "পিজি হাসপাতাল"],
        23.7389,
        90.3950,
    ),
    ("Square Hospital", ["square", "স্কয়ার", "স্কয়ার", "স্কয়ার হাসপাতাল"], 23.7525, 90.3814),
    ("Evercare Hospital Dhaka", ["evercare", "apollo", "এভারকেয়ার", "অ্যাপোলো"], 23.8103, 90.4310),
    ("United Hospital", ["united", "united hospital", "ইউনাইটেড"], 23.8045, 90.4155),
    ("Labaid Specialized Hospital", ["labaid", "ল্যাবএইড"], 23.7419, 90.3830),
    ("Ibn Sina Hospital Dhanmondi", ["ibn sina", "ibnsina", "ইবনে সিনা"], 23.7510, 90.3720),
    ("Popular Medical College Hospital", ["popular", "পপুলার"], 23.7390, 90.3820),
    ("Holy Family Red Crescent Hospital", ["holy family", "হলি ফ্যামিলি"], 23.7470, 90.4040),
    ("Mugda Medical College Hospital", ["mugda", "মুগদা"], 23.7316, 90.4295),
    ("Kurmitola General Hospital", ["kurmitola", "কুর্মিটোলা"], 23.8195, 90.4060),
    (
        "Shaheed Suhrawardy Medical College Hospital",
        ["suhrawardy", "sohrawardi", "সোহরাওয়ার্দী", "সোহরাওয়ার্দী"],
        23.7697,
        90.3713,
    ),
    ("Dhaka Shishu Hospital", ["shishu", "shishu hospital", "শিশু হাসপাতাল"], 23.7731, 90.3683),
    ("Uttara Adhunik Medical College Hospital", ["uttara adhunik", "উত্তরা আধুনিক"], 23.8740, 90.3850),
    (
        "Kuwait Bangladesh Friendship Government Hospital",
        ["kuwait", "kuwait maitree", "কুয়েত মৈত্রী", "কুয়েত মৈত্রী"],
        23.8690,
        90.3990,
    ),
    (
        "National Institute of Cardiovascular Diseases",
        ["nicvd", "heart foundation hospital", "হৃদরোগ ইনস্টিটিউট"],
        23.7700,
        90.3700,
    ),
]

BLOOD_BANKS = [
    ("Sandhani DMCH Unit (simulated)", "01700000101", 23.7262, 90.3968),
    ("Quantum Blood Lab (simulated)", "01700000102", 23.7390, 90.4120),
    ("Red Crescent Blood Centre (simulated)", "01700000103", 23.7600, 90.3600),
    ("Badhan DU Zone (simulated)", "01700000104", 23.7340, 90.3925),
    ("Thalassemia Foundation Blood Bank (simulated)", "01700000105", 23.7580, 90.3890),
    ("Uttara Community Blood Bank (simulated)", "01700000106", 23.8700, 90.3950),
]

AREAS = [
    ("Dhanmondi", 23.7465, 90.3760),
    ("Mohammadpur", 23.7650, 90.3580),
    ("Mirpur", 23.8060, 90.3680),
    ("Gulshan", 23.7925, 90.4078),
    ("Banani", 23.7940, 90.4040),
    ("Uttara", 23.8700, 90.3990),
    ("Motijheel", 23.7330, 90.4170),
    ("Old Dhaka", 23.7100, 90.4070),
    ("Badda", 23.7800, 90.4260),
    ("Bashundhara", 23.8150, 90.4320),
    ("Shahbagh", 23.7380, 90.3950),
    ("Farmgate", 23.7580, 90.3890),
    ("Khilgaon", 23.7510, 90.4250),
    ("Jatrabari", 23.7100, 90.4350),
    ("Tejgaon", 23.7640, 90.3990),
]

# Approximate blood group distribution in Bangladesh.
GROUP_WEIGHTS = {"B+": 31, "O+": 29, "A+": 24, "AB+": 9, "O-": 2, "A-": 2, "B-": 2, "AB-": 1}

FIRST = [
    "Rahim",
    "Karim",
    "Nusrat",
    "Tanvir",
    "Farhana",
    "Sakib",
    "Mim",
    "Arif",
    "Sumaiya",
    "Imran",
    "Lamia",
    "Rafi",
    "Tania",
    "Hasan",
    "Jannat",
    "Fahim",
    "Ayesha",
    "Nayeem",
    "Sadia",
    "Rakib",
]
LAST = ["Ahmed", "Hossain", "Islam", "Rahman", "Khan", "Chowdhury", "Akter", "Uddin", "Sarker", "Kabir"]


def seed(db: Session, donors: int = 200, rng_seed: int = 327) -> dict:
    rng = random.Random(rng_seed)
    created = {"hospitals": 0, "blood_banks": 0, "donors": 0}

    if not db.scalar(select(Hospital.id).limit(1)):
        for name, aliases, lat, lng in HOSPITALS:
            db.add(Hospital(name=name, aliases=aliases, city="Dhaka", lat=lat, lng=lng, verified=True))
            created["hospitals"] += 1

    if not db.scalar(select(BloodBank.id).limit(1)):
        for name, phone, lat, lng in BLOOD_BANKS:
            db.add(BloodBank(name=name, city="Dhaka", phone=phone, lat=lat, lng=lng))
            created["blood_banks"] += 1

    for email, name, role in [
        ("admin@demo.roktodoot.org", "Demo Admin", "admin"),
        ("requester@demo.roktodoot.org", "Demo Requester", "user"),
    ]:
        if not db.scalar(select(User.id).where(User.email == email)):
            db.add(
                User(
                    email=email,
                    name=name,
                    role=role,
                    phone="01800000001" if role == "user" else None,
                    phone_verified=role == "user",
                )
            )

    groups, weights = zip(*GROUP_WEIGHTS.items(), strict=True)
    today = date.today()
    for i in range(1, donors + 1):
        email = f"donor{i:03d}@demo.roktodoot.org"
        if db.scalar(select(User.id).where(User.email == email)):
            continue
        area, alat, alng = rng.choice(AREAS)
        u = User(
            email=email,
            name=f"{rng.choice(FIRST)} {rng.choice(LAST)}",
            phone=f"019{i:08d}",
            phone_verified=rng.random() < 0.8,
        )
        db.add(u)
        db.flush()
        last = None if rng.random() < 0.35 else today - timedelta(days=rng.randint(10, 400))
        db.add(
            DonorProfile(
                user_id=u.id,
                blood_group=rng.choices(groups, weights)[0],
                lat=alat + rng.uniform(-0.02, 0.02),
                lng=alng + rng.uniform(-0.02, 0.02),
                area=area,
                last_donation_date=last,
                available=rng.random() < 0.85,
                contacted_count=(c := rng.randint(0, 10)),
                accepted_count=rng.randint(0, c),
                label=f"D-{rng.randint(0, 0xFFFF):04X}",
            )
        )
        created["donors"] += 1

    db.commit()
    return created


if __name__ == "__main__":
    dbmod.init_db()
    with dbmod.SessionLocal() as s:
        print("Seeded:", seed(s))
