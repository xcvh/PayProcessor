import pandas as pd
import requests
from pathlib import Path
import logging
from typing import Set, Optional, Dict
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor
from requests.exceptions import RequestException
import hashlib

class ExcelParsingError(Exception):
    """Custom exception for Excel parsing errors"""
    pass

class DownloadError(Exception):
    """Custom exception for download-related errors"""
    pass

class PDFExtractionService:
    # Constants
    MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024  # 50MB
    DOWNLOAD_TIMEOUT = 30  # seconds
    MAX_WORKERS = 5
    REQUIRED_COLUMNS = {
        'Task Name',
        'Invoice (attachment)',
        'Payment Reference (short text)',
        'Area (drop down)',
        'Due Date'
    }

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.setup_logging()
        self.processed_files: Set[Path] = set()
        self.download_stats: Dict[str, int] = {'success': 0, 'failed': 0}

    def setup_logging(self):
        """Initialize logging configuration if not already configured"""
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    def get_excel_headers(self, file_path: str) -> list:
        """
        Get the headers from the Excel file.

        Args:
            file_path: Path to the Excel file

        Returns:
            List of header names

        Raises:
            ExcelParsingError: If headers cannot be read
        """
        try:
            df = pd.read_excel(file_path, header=2)
            headers = list(df.columns)

            # Log which required columns are present/missing
            missing_columns = self.REQUIRED_COLUMNS - set(headers)
            present_columns = self.REQUIRED_COLUMNS - missing_columns

            self.logger.info(f"Found headers: {headers}")
            self.logger.info(f"Required columns present: {present_columns}")
            if missing_columns:
                self.logger.warning(f"Missing required columns: {missing_columns}")

            return headers

        except Exception as e:
            raise ExcelParsingError(f"Failed to read Excel headers: {str(e)}")

    def parse_excel(self, file_path: str) -> pd.DataFrame:
        """
        Parse the Excel file and validate its structure.

        Args:
            file_path: Path to the Excel file

        Returns:
            DataFrame containing the parsed data

        Raises:
            ExcelParsingError: If the file structure is invalid
        """
        try:
            df = pd.read_excel(file_path, header=2)

            # Validate required columns
            missing_columns = self.REQUIRED_COLUMNS - set(df.columns)
            if missing_columns:
                raise ExcelParsingError(
                    f"Missing required columns: {', '.join(missing_columns)}"
                )

            # Filter rows with attachments and validate data
            valid_rows = df[df['Invoice (attachment)'].notna()].copy()

            # Validate URLs
            valid_rows['Valid_URL'] = valid_rows['Invoice (attachment)'].apply(
                self.is_valid_url
            )
            invalid_urls = valid_rows[~valid_rows['Valid_URL']]

            if not valid_rows['Valid_URL'].any():
                raise ExcelParsingError("No valid URLs found in attachment column")

            if not invalid_urls.empty:
                self.logger.warning(
                    f"Found {len(invalid_urls)} invalid URLs. These will be skipped."
                )

            return valid_rows[valid_rows['Valid_URL']].drop('Valid_URL', axis=1)

        except Exception as e:
            raise ExcelParsingError(f"Failed to parse Excel file: {str(e)}")

    @staticmethod
    def is_valid_url(url: str) -> bool:
        """Validate URL format"""
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except:
            return False

    def organize_files(self, base_dir: str, primary: str, secondary: str) -> Path:
        """
        Create and return paths for organized directories.

        Args:
            base_dir: Base directory path
            primary: Primary organization level
            secondary: Secondary organization level

        Returns:
            Path object for the created directory
        """
        primary_dir = Path(base_dir) / str(primary)
        if secondary:
            final_dir = primary_dir / str(secondary).replace('/', '-')
        else:
            final_dir = primary_dir

        final_dir.mkdir(parents=True, exist_ok=True)
        return final_dir

    async def download_file(
        self,
        url: str,
        destination: Path,
        session: Optional[requests.Session] = None
    ) -> bool:
        """
        Download a file from a URL with proper validation and error handling.

        Args:
            url: URL to download from
            destination: Path to save the file
            session: Optional requests session for connection reuse

        Returns:
            bool indicating success or failure
        """
        try:
            if destination in self.processed_files:
                self.logger.warning(f"File already exists: {destination}")
                return False

            session = session or requests

            # First make a HEAD request to check file type and size
            head_response = session.head(url, timeout=self.DOWNLOAD_TIMEOUT)

            # Validate content type
            content_type = head_response.headers.get('content-type', '').lower()
            if 'pdf' not in content_type:
                raise DownloadError(f"Invalid content type: {content_type}")

            # Check file size
            content_length = int(head_response.headers.get('content-length', 0))
            if content_length > self.MAX_DOWNLOAD_SIZE:
                raise DownloadError(f"File too large: {content_length} bytes")

            # Download the file
            response = session.get(url, timeout=self.DOWNLOAD_TIMEOUT)
            response.raise_for_status()

            # Verify the downloaded content
            if not response.content:
                raise DownloadError("Empty file downloaded")

            # Save the file
            destination.write_bytes(response.content)
            self.processed_files.add(destination)
            self.download_stats['success'] += 1
            self.logger.info(f"Successfully downloaded: {destination.name}")
            return True

        except RequestException as e:
            self.download_stats['failed'] += 1
            self.logger.error(f"Download failed for {url}: {str(e)}")
            return False

        except Exception as e:
            self.download_stats['failed'] += 1
            self.logger.error(f"Unexpected error downloading {url}: {str(e)}")
            return False

    def generate_unique_filename(self, base_name: str, task: str, pr: str) -> str:
        """Generate a unique filename for the download"""
        # Clean the base components
        cleaned_task = "".join(c for c in task if c.isalnum() or c in "_ ").strip()
        cleaned_pr = "".join(c for c in pr if c.isalnum() or c in "_ ").strip()

        # Create base filename
        base = f"{cleaned_task}_{cleaned_pr}"

        # Add hash if needed to ensure uniqueness
        if base in self.processed_files:
            hash_suffix = hashlib.md5(f"{task}{pr}".encode()).hexdigest()[:8]
            base = f"{base}_{hash_suffix}"

        return f"{base}.pdf"

    def process_excel(
        self,
        file_path: str,
        output_dir: str,
        organize_by: str = 'Year/Area'
    ) -> Dict[str, int]:
        """
        Process an Excel file to download and organize files.

        Args:
            file_path: Path to the input Excel file
            output_dir: Base directory for downloads
            organize_by: Organization strategy ('Year/Area', 'Area/Year', 'Year', 'Area')

        Returns:
            Dictionary with download statistics

        Raises:
            ExcelParsingError: If Excel parsing fails
            ValueError: If organization strategy is invalid
        """
        self.logger.info(f"Starting excel processing with strategy: {organize_by}")
        self.download_stats = {'success': 0, 'failed': 0}

        try:
            # Parse Excel file
            df = self.parse_excel(file_path)

            # Process each row
            with ThreadPoolExecutor(max_workers=self.MAX_WORKERS) as executor:
                futures = []

                for _, row in df.iterrows():
                    # Extract row data
                    task = str(row['Task Name'])
                    link = str(row['Invoice (attachment)'])
                    pr = str(row['Payment Reference (short text)'])
                    area = str(row['Area (drop down)'])
                    year = pd.Timestamp(row['Due Date']).year

                    # Determine directory structure
                    if organize_by == 'Year/Area':
                        dest_dir = self.organize_files(output_dir, year, area)
                    elif organize_by == 'Area/Year':
                        dest_dir = self.organize_files(output_dir, area, year)
                    elif organize_by == 'Year':
                        dest_dir = self.organize_files(output_dir, year, '')
                    elif organize_by == 'Area':
                        dest_dir = self.organize_files(output_dir, area, '')
                    else:
                        raise ValueError(f"Invalid organization strategy: {organize_by}")

                    # Generate unique filename
                    file_name = self.generate_unique_filename(dest_dir.name, task, pr)
                    file_path = dest_dir / file_name

                    # Schedule download
                    futures.append(
                        executor.submit(self.download_file, link, file_path)
                    )

                # Wait for all downloads to complete
                for future in futures:
                    future.result()

            self.logger.info(
                f"Processing completed. Success: {self.download_stats['success']}, "
                f"Failed: {self.download_stats['failed']}"
            )
            return self.download_stats

        except Exception as e:
            self.logger.error(f"Failed to process Excel file: {str(e)}")
            raise
