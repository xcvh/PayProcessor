# src/utils/path_manager.py
import os
import sys
from pathlib import Path

class PathManager:
    @staticmethod
    def get_app_support_path() -> Path:
        if getattr(sys, 'frozen', False):
            base_path = Path.home() / 'Library/Application Support/PayPyQR'
        else:
            base_path = Path(__file__).parent.parent.parent

        base_path.mkdir(parents=True, exist_ok=True)
        return base_path

    @staticmethod
    def get_database_path() -> Path:
        return PathManager.get_app_support_path() / 'entries.db'

    @staticmethod
    def get_temp_qr_path() -> Path:
        return PathManager.get_app_support_path() / 'qr.png'
