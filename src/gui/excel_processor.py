from PyQt6.QtWidgets import QWidget, QVBoxLayout, QPushButton, QListWidget, QFileDialog, QMessageBox
import pandas as pd
import os

class ExcelProcessor(QWidget):
    def __init__(self):
        super().__init__()
        layout = QVBoxLayout()
        self.setLayout(layout)

        self.upload_button = QPushButton("Upload Excel File")
        self.upload_button.clicked.connect(self.upload_file)
        layout.addWidget(self.upload_button)

        self.file_display = QListWidget()
        layout.addWidget(self.file_display)

        self.process_button = QPushButton("Process Excel File")
        self.process_button.setEnabled(False)
        self.process_button.clicked.connect(self.process_file)
        layout.addWidget(self.process_button)

        self.file_path = None

    def upload_file(self):
        file_dialog = QFileDialog()
        file_dialog.setFileMode(QFileDialog.FileMode.ExistingFile)
        file_dialog.setNameFilter("Excel Files (*.xls *.xlsx)")
        if file_dialog.exec():
            selected_files = file_dialog.selectedFiles()
            if selected_files:
                self.file_path = selected_files[0]
                self.file_display.addItem(f"Loaded: {self.file_path}")
                self.process_button.setEnabled(True)

    def process_file(self):
        if not self.file_path:
            QMessageBox.warning(self, "No File", "Please upload an Excel file first.")
            return

        try:
            df = pd.read_excel(self.file_path, header=2)
            df = df[df['Invoice (attachment)'].notna()]

            base_dir = 'downloads'
            os.makedirs(base_dir, exist_ok=True)

            for _, row in df.iterrows():
                task = row['Task Name']
                self.file_display.addItem(f"Processed: {task}")

            QMessageBox.information(self, "Success", "Excel file processed successfully.")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"An error occurred: {e}")
