from pathlib import Path
from typing import Dict, Optional
import segno.helpers
from src.models.models import Payment, IBAN, Recipient

class QRGenerator:
    @staticmethod
    def generate_qr(payment_data: Dict, save_path: Path) -> bool:
        """
        Generate QR code from payment data.

        Args:
            payment_data: Dictionary containing:
                - name: Recipient name
                - iban: IBAN number
                - amount: Payment amount
                - reference: Payment reference
            save_path: Path where QR code should be saved

        Returns:
            bool: True if QR code was generated successfully, False otherwise
        """
        try:
            if not payment_data.get('name') or not payment_data.get('iban'):
                return False

            qr_code = segno.helpers.make_epc_qr(
                name=payment_data['name'],
                iban=payment_data['iban'],
                amount=payment_data['amount'],
                text=payment_data['reference'] or None
            )
            qr_code.save(str(save_path), scale=10)
            return True
        except Exception as e:
            print(f"Error generating QR code: {e}")
            return False
