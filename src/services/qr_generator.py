# src/services/qr_generator.py
from pathlib import Path
from typing import Optional
import segno.helpers
from ..models.entry import Entry

class QRGenerator:
    @staticmethod
    def generate_qr(entry: Entry, save_path: Path) -> bool:
        try:
            if not entry.name or not entry.iban:
                return False

            qr_code = segno.helpers.make_epc_qr(
                name=entry.name,
                iban=entry.iban,
                amount=entry.amount,
                text=entry.reference or None
            )
            qr_code.save(str(save_path), scale=10)
            return True
        except Exception as e:
            print(f"Error generating QR code: {e}")
            return False
