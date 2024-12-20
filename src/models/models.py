# src/models/models.py
from dataclasses import dataclass
from typing import Optional, List
from datetime import datetime

@dataclass
class Payment:
    id: Optional[int]
    amount: float
    reference: str
    created_at: datetime
    iban_id: int

@dataclass
class IBAN:
    id: Optional[int]
    iban: str
    recipient_id: int
    payments: List[Payment] = None

@dataclass
class Recipient:
    id: Optional[int]
    name: str
    ibans: List[IBAN] = None
