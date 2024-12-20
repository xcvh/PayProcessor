# src/database/database_manager.py
import sqlite3
from typing import List, Optional
from pathlib import Path
from datetime import datetime
from ..models.models import Recipient, IBAN, Payment

class DatabaseManager:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._initialize_db()

    def _initialize_db(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            # Enable foreign key support
            cursor.execute('PRAGMA foreign_keys = ON')

            # Create recipients table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS recipients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE
                )
            ''')

            # Create IBANs table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS ibans (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    iban TEXT NOT NULL,
                    recipient_id INTEGER NOT NULL,
                    FOREIGN KEY (recipient_id) REFERENCES recipients (id) ON DELETE CASCADE,
                    UNIQUE (iban, recipient_id)
                )
            ''')

            # Create payments table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    amount REAL NOT NULL,
                    reference TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    iban_id INTEGER NOT NULL,
                    FOREIGN KEY (iban_id) REFERENCES ibans (id) ON DELETE CASCADE
                )
            ''')

            # Migrate existing data if old table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='entries'")
            if cursor.fetchone():
                print("Migrating existing data...")
                self._migrate_old_data(cursor)
                cursor.execute("DROP TABLE entries")

    def _migrate_old_data(self, cursor):
        # Get all entries from old table
        cursor.execute('SELECT name, iban, amount, reference FROM entries')
        old_entries = cursor.fetchall()

        for name, iban, amount, reference in old_entries:
            # Add recipient if not exists
            cursor.execute(
                'INSERT OR IGNORE INTO recipients (name) VALUES (?)',
                (name,)
            )
            cursor.execute('SELECT id FROM recipients WHERE name = ?', (name,))
            recipient_id = cursor.fetchone()[0]

            # Add IBAN if not exists
            cursor.execute(
                'INSERT OR IGNORE INTO ibans (iban, recipient_id) VALUES (?, ?)',
                (iban, recipient_id)
            )
            cursor.execute('SELECT id FROM ibans WHERE iban = ? AND recipient_id = ?',
                         (iban, recipient_id))
            iban_id = cursor.fetchone()[0]

            # Add payment
            cursor.execute(
                '''INSERT INTO payments (amount, reference, iban_id)
                   VALUES (?, ?, ?)''',
                (amount, reference, iban_id)
            )

    def get_all_recipients(self) -> List[Recipient]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id, name FROM recipients ORDER BY name')
            return [Recipient(id=row[0], name=row[1]) for row in cursor.fetchall()]

    def get_recipient_with_ibans(self, recipient_id: int) -> Optional[Recipient]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            # Get recipient
            cursor.execute('SELECT id, name FROM recipients WHERE id = ?', (recipient_id,))
            recipient_row = cursor.fetchone()
            if not recipient_row:
                return None

            # Get IBANs for this recipient
            cursor.execute('SELECT id, iban FROM ibans WHERE recipient_id = ?', (recipient_id,))
            ibans = [IBAN(id=row[0], iban=row[1], recipient_id=recipient_id)
                    for row in cursor.fetchall()]

            return Recipient(id=recipient_row[0], name=recipient_row[1], ibans=ibans)

    def get_iban_with_payments(self, iban_id: int) -> Optional[IBAN]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            # Get IBAN
            cursor.execute('SELECT id, iban, recipient_id FROM ibans WHERE id = ?', (iban_id,))
            iban_row = cursor.fetchone()
            if not iban_row:
                return None

            # Get payments for this IBAN
            cursor.execute('''
                SELECT id, amount, reference, created_at
                FROM payments
                WHERE iban_id = ?
                ORDER BY created_at DESC
            ''', (iban_id,))

            payments = [
                Payment(
                    id=row[0],
                    amount=row[1],
                    reference=row[2],
                    created_at=datetime.fromisoformat(row[3]),
                    iban_id=iban_id
                )
                for row in cursor.fetchall()
            ]

            return IBAN(
                id=iban_row[0],
                iban=iban_row[1],
                recipient_id=iban_row[2],
                payments=payments
            )

    def add_recipient(self, name: str) -> int:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('INSERT INTO recipients (name) VALUES (?)', (name,))
            return cursor.lastrowid

    def add_iban(self, iban: str, recipient_id: int) -> int:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO ibans (iban, recipient_id) VALUES (?, ?)',
                (iban, recipient_id)
            )
            return cursor.lastrowid

    def add_payment(self, amount: float, reference: str, iban_id: int) -> int:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO payments (amount, reference, iban_id) VALUES (?, ?, ?)',
                (amount, reference, iban_id)
            )
            return cursor.lastrowid

    def search_recipients(self, query: str) -> List[Recipient]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT id, name FROM recipients WHERE name LIKE ? ORDER BY name',
                (f'%{query}%',)
            )
            return [Recipient(id=row[0], name=row[1]) for row in cursor.fetchall()]

    def delete_recipient(self, recipient_id: int) -> bool:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM recipients WHERE id = ?', (recipient_id,))
            return cursor.rowcount > 0

    def delete_iban(self, iban_id: int) -> bool:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM ibans WHERE id = ?', (iban_id,))
            return cursor.rowcount > 0

    def delete_payment(self, payment_id: int) -> bool:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM payments WHERE id = ?', (payment_id,))
            return cursor.rowcount > 0
