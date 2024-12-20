from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QPushButton, QListWidget, QFileDialog, QMessageBox,
    QHBoxLayout, QRadioButton, QProgressBar, QButtonGroup, QLabel
)
from pathlib import Path
import logging
from typing import Optional
from src.services.extract_pdfs_service import PDFExtractionService

class ExcelProcessorGUI(QWidget):
    def __init__(self):
        super().__init__()
        self.setup_logging()
        self.pdf_service = PDFExtractionService()
        self.init_ui()

        self.file_path: Optional[str] = None
        self.output_dir = str(Path.home() / "Downloads")

    def setup_logging(self):
        """Initialize logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)

    def init_ui(self):
        """Initialize the user interface"""
        self.setWindowTitle("Excel Processor")
        layout = QVBoxLayout()
        self.setLayout(layout)

        # File Selection Section
        self.setup_file_selection(layout)

        # Headers Section
        self.setup_headers_section(layout)

        # Output Directory Section
        self.setup_output_selection(layout)

        # Organization Options Section
        self.setup_organization_options(layout)

        # Progress Bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        layout.addWidget(self.progress_bar)

        # Process Button
        self.process_button = QPushButton("Process Excel File")
        self.process_button.setEnabled(False)
        self.process_button.clicked.connect(self.process_file)
        layout.addWidget(self.process_button)

    def setup_headers_section(self, layout: QVBoxLayout):
        """Setup the headers display section"""
        headers_section = QVBoxLayout()

        # Label
        headers_label = QLabel("Detected Headers:")
        headers_section.addWidget(headers_label)

        # Headers Display
        self.headers_display = QListWidget()
        headers_section.addWidget(self.headers_display)

        layout.addLayout(headers_section)

    def setup_file_selection(self, layout: QVBoxLayout):
        """Setup the file selection section"""
        file_section = QVBoxLayout()

        # Label
        file_label = QLabel("Excel File:")
        file_section.addWidget(file_label)

        # Upload Button
        self.upload_button = QPushButton("Upload Excel File")
        self.upload_button.clicked.connect(self.upload_file)
        file_section.addWidget(self.upload_button)

        # File Display
        self.file_display = QListWidget()
        file_section.addWidget(self.file_display)

        layout.addLayout(file_section)

    def setup_output_selection(self, layout: QVBoxLayout):
        """Setup the output directory selection section"""
        output_section = QVBoxLayout()

        # Label
        output_label = QLabel("Output Directory:")
        output_section.addWidget(output_label)

        # Output Selection
        output_layout = QHBoxLayout()
        self.output_button = QPushButton("Select Output Folder")
        self.output_button.clicked.connect(self.select_output_folder)
        output_layout.addWidget(self.output_button)

        self.output_folder_display = QListWidget()
        output_layout.addWidget(self.output_folder_display)

        output_section.addLayout(output_layout)
        layout.addLayout(output_section)

    def setup_organization_options(self, layout: QVBoxLayout):
        """Setup the organization options section"""
        # Label
        options_label = QLabel("Organization Structure:")
        layout.addWidget(options_label)

        # Radio Buttons
        self.options_layout = QHBoxLayout()
        self.button_group = QButtonGroup(self)

        options = [
            ("Year/Area", "Year/Area"),
            ("Area/Year", "Area/Year"),
            ("Year Only", "Year"),
            ("Area Only", "Area")
        ]

        for text, value in options:
            radio = QRadioButton(text)
            radio.setProperty("value", value)
            self.button_group.addButton(radio)
            self.options_layout.addWidget(radio)
            if value == "Year/Area":  # Default option
                radio.setChecked(True)

        layout.addLayout(self.options_layout)

    def upload_file(self):
        """Handle file upload"""
        try:
            file_dialog = QFileDialog()
            file_dialog.setFileMode(QFileDialog.FileMode.ExistingFile)
            file_dialog.setNameFilter("Excel Files (*.xls *.xlsx)")

            if file_dialog.exec():
                selected_files = file_dialog.selectedFiles()
                if selected_files:
                    self.file_path = selected_files[0]
                    self.file_display.clear()
                    self.file_display.addItem(f"Loaded: {self.file_path}")

                    # Get and display headers
                    try:
                        headers = self.pdf_service.get_excel_headers(self.file_path)
                        self.headers_display.clear()
                        for header in headers:
                            self.headers_display.addItem(str(header))
                        self.process_button.setEnabled(True)
                        self.logger.info(f"File loaded and headers detected: {headers}")
                    except Exception as e:
                        self.logger.error(f"Error reading headers: {e}")
                        self.show_error("Header Detection Error", f"Failed to read headers: {str(e)}")
                        return

                    self.process_button.setEnabled(True)
                    self.logger.info(f"File loaded: {self.file_path}")
        except Exception as e:
            self.logger.error(f"Error during file upload: {e}")
            self.show_error("File Upload Error", f"Failed to load file: {str(e)}")

    def select_output_folder(self):
        """Handle output folder selection"""
        try:
            folder_dialog = QFileDialog()
            folder_dialog.setFileMode(QFileDialog.FileMode.Directory)
            folder_dialog.setOption(QFileDialog.Option.ShowDirsOnly, True)

            if folder_dialog.exec():
                selected_folders = folder_dialog.selectedFiles()
                if selected_folders:
                    self.output_dir = selected_folders[0]
                    self.output_folder_display.clear()
                    self.output_folder_display.addItem(f"Output Folder: {self.output_dir}")
                    self.logger.info(f"Output directory set: {self.output_dir}")
        except Exception as e:
            self.logger.error(f"Error during output folder selection: {e}")
            self.show_error("Folder Selection Error", f"Failed to select folder: {str(e)}")

    def process_file(self):
        """Handle file processing"""
        if not self.file_path:
            self.show_warning("No File", "Please upload an Excel file first.")
            return

        if not Path(self.output_dir).exists():
            self.show_error("Invalid Directory", "Output directory does not exist.")
            return

        if not self.verify_write_permissions():
            self.show_error("Permission Error", "Cannot write to output directory.")
            return

        try:
            self.progress_bar.setVisible(True)
            self.progress_bar.setRange(0, 0)  # Indeterminate progress
            self.process_button.setEnabled(False)

            # Get selected organization option
            selected_button = self.button_group.checkedButton()
            organize_by = selected_button.property("value")

            # Process the file using the service
            stats = self.pdf_service.process_excel(
                file_path=self.file_path,
                output_dir=self.output_dir,
                organize_by=organize_by
            )

            self.logger.info(f"File processing completed. Stats: {stats}")
            success_msg = (f"Excel file processed successfully.\n"
                         f"Files downloaded: {stats['success']}\n"
                         f"Files failed: {stats['failed']}")
            self.show_info("Success", success_msg)

        except Exception as e:
            self.logger.error(f"Error during file processing: {e}")
            self.show_error("Processing Error", f"An error occurred: {str(e)}")

        finally:
            self.progress_bar.setVisible(False)
            self.process_button.setEnabled(True)

    def show_error(self, title: str, message: str):
        """Display error message box"""
        QMessageBox.critical(self, title, message)

    def show_warning(self, title: str, message: str):
        """Display warning message box"""
        QMessageBox.warning(self, title, message)

    def show_info(self, title: str, message: str):
        """Display info message box"""
        QMessageBox.information(self, title, message)

    def verify_write_permissions(self) -> bool:
        """Verify write permissions for output directory"""
        try:
            test_file = Path(self.output_dir) / ".test_write_permission"
            test_file.touch()
            test_file.unlink()
            return True
        except:
            return False
