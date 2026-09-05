"""Deterministic generators for believable Indian demo data.

Deterministic on purpose: the same seed produces the same database every time, so a
demo you rehearsed looks identical when you present it. Pass a different `seed` only if
you want fresh data.

"Believable" matters more than people expect — a judge scrolling a table of
"Test User 1 / Test User 2" reads it as unfinished.
"""

import random
from datetime import UTC, date, datetime, timedelta

FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
    "Ishaan", "Rohan", "Ananya", "Diya", "Aadhya", "Saanvi", "Pari", "Anika",
    "Navya", "Meera", "Sneha", "Kavya", "Rahul", "Priya", "Amit", "Neha",
    "Karthik", "Divya", "Manish", "Pooja", "Rakesh", "Shreya",
]

LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Gupta", "Singh", "Reddy", "Nair", "Iyer",
    "Desai", "Joshi", "Kapoor", "Mehta", "Rathva", "Shah", "Deshmukh",
    "Chauhan", "Pillai", "Bose", "Kulkarni", "Rao",
]

# (city, state, state_code, lat, lng) — real coordinates, in case the PS wants a map.
CITIES = [
    ("Ahmedabad", "Gujarat", "GJ", 23.0225, 72.5714),
    ("Surat", "Gujarat", "GJ", 21.1702, 72.8311),
    ("Vadodara", "Gujarat", "GJ", 22.3072, 73.1812),
    ("Gandhinagar", "Gujarat", "GJ", 23.2156, 72.6369),
    ("Mumbai", "Maharashtra", "MH", 19.0760, 72.8777),
    ("Pune", "Maharashtra", "MH", 18.5204, 73.8567),
    ("Nagpur", "Maharashtra", "MH", 21.1458, 79.0882),
    ("Delhi", "Delhi", "DL", 28.6139, 77.2090),
    ("Jaipur", "Rajasthan", "RJ", 26.9124, 75.7873),
    ("Bengaluru", "Karnataka", "KA", 12.9716, 77.5946),
    ("Chennai", "Tamil Nadu", "TN", 13.0827, 80.2707),
    ("Hyderabad", "Telangana", "TS", 17.3850, 78.4867),
    ("Kolkata", "West Bengal", "WB", 22.5726, 88.3639),
    ("Indore", "Madhya Pradesh", "MP", 22.7196, 75.8577),
]

# Derived from CITIES so it can never drift out of sync. The previous project kept a
# separate hand-written dict and two states silently got the wrong code.
STATE_CODES = {state: code for _, state, code, _, _ in CITIES}


class Gen:
    """Seeded generator. `Gen(42)` always produces the same data."""

    def __init__(self, seed: int = 42) -> None:
        self.rng = random.Random(seed)

    def person_name(self) -> str:
        return f"{self.rng.choice(FIRST_NAMES)} {self.rng.choice(LAST_NAMES)}"

    def email(self, name: str, domain: str = "example.in") -> str:
        first, _, last = name.lower().partition(" ")
        return f"{first}.{last}{self.rng.randint(1, 99)}@{domain}"

    def phone(self) -> str:
        return f"+91{self.rng.choice('6789')}{self.rng.randint(10**8, 10**9 - 1)}"

    def city(self) -> tuple[str, str, str, float, float]:
        return self.rng.choice(CITIES)

    def plate(self, state_code: str | None = None) -> str:
        code = state_code or self.rng.choice(list(STATE_CODES.values()))
        letters = "".join(self.rng.choices("ABCDEFGHJKLMNPQRSTUVWXYZ", k=2))
        return f"{code}{self.rng.randint(1, 39):02d}{letters}{self.rng.randint(1000, 9999)}"

    def money(self, low: int, high: int) -> float:
        return round(self.rng.uniform(low, high), 2)

    def past_datetime(self, days_back: int = 60) -> datetime:
        return datetime.now(UTC) - timedelta(
            days=self.rng.randint(0, days_back),
            hours=self.rng.randint(0, 23),
            minutes=self.rng.randint(0, 59),
        )

    def future_date(self, days_ahead: int = 365) -> date:
        return (datetime.now(UTC) + timedelta(days=self.rng.randint(1, days_ahead))).date()

    def past_date(self, days_back: int = 365) -> date:
        return (datetime.now(UTC) - timedelta(days=self.rng.randint(1, days_back))).date()

    def maybe(self, probability: float) -> bool:
        return self.rng.random() < probability
