# src/models/entry.py
from dataclasses import dataclass
from typing import Optional

@dataclass
class Entry:
    id: Optional[int]
    name: str
    iban: str
    amount: float
    reference: str
