import sys
import os
import tempfile
from pathlib import Path
from typing import Optional
import logging
import shutil
from datetime import datetime, timedelta

class PathManager:
    """
    Manages application paths across different operating systems.
    Handles path creation, cleanup, and access to common directories.
    """

    # Class-level constants
    APP_NAME = "PayProcessor"
    DEFAULT_DB_NAME = "entries.db"
    TEMP_FILE_PREFIX = "qr_"
    TEMP_FILE_SUFFIX = ".png"
    TEMP_FILE_MAX_AGE = timedelta(hours=24)

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._base_path: Optional[Path] = None
        self._temp_dir: Optional[Path] = None
        self.setup_logging()

    def setup_logging(self) -> None:
        """Initialize logging configuration"""
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    @property
    def base_path(self) -> Path:
        """
        Get the base application path based on the operating system.
        Creates the directory if it doesn't exist.

        Returns:
            Path: Base application directory path
        """
        if self._base_path is None:
            if sys.platform == "darwin":  # macOS
                self._base_path = Path.home() / "Library/Application Support" / self.APP_NAME
            elif sys.platform == "win32":  # Windows
                self._base_path = Path(os.getenv('APPDATA', str(Path.home()))) / self.APP_NAME
            elif sys.platform == "linux":  # Linux
                self._base_path = Path.home() / f".{self.APP_NAME.lower()}"
            else:
                self._base_path = Path.home() / f".{self.APP_NAME.lower()}"
                self.logger.warning(f"Unrecognized platform: {sys.platform}. Using home directory.")

            try:
                self._base_path.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                self.logger.error(f"Failed to create base directory: {e}")
                raise

        return self._base_path

    @property
    def database_path(self) -> Path:
        """
        Get the database file path.

        Returns:
            Path: Database file path
        """
        return self.base_path / self.DEFAULT_DB_NAME

    @property
    def temp_dir(self) -> Path:
        """
        Get the temporary directory path.
        Creates a dedicated temp directory if it doesn't exist.

        Returns:
            Path: Temporary directory path
        """
        if self._temp_dir is None:
            temp_base = Path(tempfile.gettempdir())
            self._temp_dir = temp_base / self.APP_NAME
            try:
                self._temp_dir.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                self.logger.error(f"Failed to create temp directory: {e}")
                raise

        return self._temp_dir

    def get_new_temp_qr_path(self) -> Path:
        """
        Generate a path for a new temporary QR code file.

        Returns:
            Path: New temporary file path
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"{self.TEMP_FILE_PREFIX}{timestamp}{self.TEMP_FILE_SUFFIX}"
        return self.temp_dir / filename

    def cleanup_temp_files(self, max_age: Optional[timedelta] = None) -> None:
        """
        Clean up old temporary files.

        Args:
            max_age: Maximum age for temp files before deletion. Defaults to TEMP_FILE_MAX_AGE.
        """
        if max_age is None:
            max_age = self.TEMP_FILE_MAX_AGE

        current_time = datetime.now()
        try:
            for temp_file in self.temp_dir.glob(f"{self.TEMP_FILE_PREFIX}*{self.TEMP_FILE_SUFFIX}"):
                file_age = current_time - datetime.fromtimestamp(temp_file.stat().st_mtime)
                if file_age > max_age:
                    try:
                        temp_file.unlink()
                        self.logger.info(f"Deleted old temp file: {temp_file}")
                    except Exception as e:
                        self.logger.warning(f"Failed to delete temp file {temp_file}: {e}")
        except Exception as e:
            self.logger.error(f"Error during temp file cleanup: {e}")

    def ensure_directory_exists(self, path: Path) -> None:
        """
        Ensure a directory exists, creating it if necessary.

        Args:
            path: Directory path to check/create
        """
        try:
            path.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            self.logger.error(f"Failed to create directory {path}: {e}")
            raise

    def clear_all_temp_files(self) -> None:
        """Remove all temporary files and recreate the temp directory"""
        try:
            if self._temp_dir and self._temp_dir.exists():
                shutil.rmtree(self._temp_dir)
                self._temp_dir = None  # Reset so it will be recreated on next access
                self.logger.info("Cleared all temporary files")
        except Exception as e:
            self.logger.error(f"Failed to clear temporary files: {e}")
            raise

    def get_logs_path(self) -> Path:
        """
        Get the path for application logs.

        Returns:
            Path: Logs directory path
        """
        logs_path = self.base_path / "logs"
        self.ensure_directory_exists(logs_path)
        return logs_path

    def get_config_path(self) -> Path:
        """
        Get the path for configuration files.

        Returns:
            Path: Configuration directory path
        """
        config_path = self.base_path / "config"
        self.ensure_directory_exists(config_path)
        return config_path

    def is_path_writable(self, path: Path) -> bool:
        """
        Check if a path is writable.

        Args:
            path: Path to check

        Returns:
            bool: True if writable, False otherwise
        """
        if not path.exists():
            try:
                self.ensure_directory_exists(path)
            except Exception:
                return False

        try:
            test_file = path / ".write_test"
            test_file.touch()
            test_file.unlink()
            return True
        except Exception:
            return False

    def __del__(self):
        """Cleanup on object destruction"""
        try:
            self.cleanup_temp_files()
        except Exception as e:
            # Don't raise exceptions in destructor
            self.logger.warning(f"Failed to cleanup during destruction: {e}")
