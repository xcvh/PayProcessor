# src/database/database_manager.py
import sqlite3
from typing import List, Optional
from pathlib import Path
from ..models.entry import Entry

class DatabaseManager:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._initialize_db()

    def _initialize_db(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    iban TEXT,
                    amount REAL,
                    reference TEXT
                )
            ''')

    def get_all_entries(self) -> List[Entry]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id, name, iban, amount, reference FROM entries')
            return [Entry(*row) for row in cursor.fetchall()]

    def get_entry_by_id(self, entry_id: int) -> Optional[Entry]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT id, name, iban, amount, reference FROM entries WHERE id = ?',
                (entry_id,)
            )
            row = cursor.fetchone()
            return Entry(*row) if row else None

    def add_entry(self, entry: Entry) -> int:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO entries (name, iban, amount, reference) VALUES (?, ?, ?, ?)',
                (entry.name, entry.iban, entry.amount, entry.reference)
            )
            return cursor.lastrowid

    def delete_entry(self, entry_id: int) -> bool:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM entries WHERE id = ?', (entry_id,))
            return cursor.rowcount > 0
