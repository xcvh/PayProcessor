from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QPushButton, QListWidget, QFileDialog, QMessageBox, QHBoxLayout, QCheckBox
)
from pathlib import Path
from src.services.extract_pdfs_service import parse_excel

class ExcelProcessorGUI(QWidget):
    def __init__(self):
        super().__init__()

        self.setWindowTitle("Excel Processor")
        layout = QVBoxLayout()
        self.setLayout(layout)

        # Upload Button
        self.upload_button = QPushButton("Upload Excel File")
        self.upload_button.clicked.connect(self.upload_file)
        layout.addWidget(self.upload_button)

        # File Display
        self.file_display = QListWidget()
        layout.addWidget(self.file_display)

        # Output Folder Selection
        output_layout = QHBoxLayout()
        self.output_button = QPushButton("Select Output Folder")
        self.output_button.clicked.connect(self.select_output_folder)
        output_layout.addWidget(self.output_button)

        self.output_folder_display = QListWidget()
        output_layout.addWidget(self.output_folder_display)

        layout.addLayout(output_layout)

        # Organization Options
        self.options_layout = QHBoxLayout()

        self.year_area_checkbox = QCheckBox("Year/Area")
        self.year_area_checkbox.setChecked(True)
        self.options_layout.addWidget(self.year_area_checkbox)

        self.area_year_checkbox = QCheckBox("Area/Year")
        self.options_layout.addWidget(self.area_year_checkbox)

        self.year_only_checkbox = QCheckBox("Only Year")
        self.options_layout.addWidget(self.year_only_checkbox)

        self.area_only_checkbox = QCheckBox("Only Area")
        self.options_layout.addWidget(self.area_only_checkbox)

        layout.addLayout(self.options_layout)

        # Process Button
        self.process_button = QPushButton("Process Excel File")
        self.process_button.setEnabled(False)
        self.process_button.clicked.connect(self.process_file)
        layout.addWidget(self.process_button)

        self.file_path = None
        self.output_dir = str(Path.home() / "Downloads")

    def upload_file(self):
        file_dialog = QFileDialog()
        file_dialog.setFileMode(QFileDialog.FileMode.ExistingFile)
        file_dialog.setNameFilter("Excel Files (*.xls *.xlsx)")
        if file_dialog.exec():
            selected_files = file_dialog.selectedFiles()
            if selected_files:
                self.file_path = selected_files[0]
                self.file_display.clear()
                self.file_display.addItem(f"Loaded: {self.file_path}")
                self.process_button.setEnabled(True)

    def select_output_folder(self):
        folder_dialog = QFileDialog()
        folder_dialog.setFileMode(QFileDialog.FileMode.Directory)
        folder_dialog.setOption(QFileDialog.Option.ShowDirsOnly, True)
        if folder_dialog.exec():
            selected_folders = folder_dialog.selectedFiles()
            if selected_folders:
                self.output_dir = selected_folders[0]
                self.output_folder_display.clear()
                self.output_folder_display.addItem(f"Output Folder: {self.output_dir}")

    def process_file(self):
        if not self.file_path:
            QMessageBox.warning(self, "No File", "Please upload an Excel file first.")
            return

        organize_by = "Year/Area"
        if self.area_year_checkbox.isChecked():
            organize_by = "Area/Year"
        elif self.year_only_checkbox.isChecked():
            organize_by = "Year"
        elif self.area_only_checkbox.isChecked():
            organize_by = "Area"

        try:
            parse_excel(
                file_path=self.file_path,
                output_dir=self.output_dir,
                organize_by=organize_by
            )
            QMessageBox.information(self, "Success", "Excel file processed successfully.")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"An error occurred: {e}")
