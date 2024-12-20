# src/gui/main_window.py
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QListWidget, QLabel,
    QLineEdit, QPushButton, QFileDialog, QListWidgetItem
)
from PyQt6.QtGui import QPixmap
from PyQt6.QtCore import Qt
from datetime import date
from pathlib import Path

from src.models.entry import Entry
from src.database.database_manager import DatabaseManager
from src.services.qr_generator import QRGenerator
from src.utils.path_manager import PathManager

class MainWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.db_manager = DatabaseManager(PathManager.get_database_path())
        self.qr_generator = QRGenerator()
        self.init_ui()

    def init_ui(self):
        self.setWindowTitle('PayPyQR')
        self.setGeometry(100, 100, 600, 400)

        # Create UI components
        self.create_ui_components()

        # Create layouts
        self.create_layouts()

        # Connect signals
        self.connect_signals()

        # Load initial data
        self.load_entries()

    def create_ui_components(self):
        self.list_widget = QListWidget()
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText('Search...')

        self.textbox_name = QLineEdit()
        self.textbox_iban = QLineEdit()
        self.textbox_amount = QLineEdit()
        self.textbox_reference = QLineEdit()

        self.qr_label = QLabel()
        self.qr_label.setFixedSize(200, 200)
        self.qr_label.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self.button_save = QPushButton('Save Entry')
        self.button_delete = QPushButton('Delete Entry')
        self.button_save_qr = QPushButton('Save QR Code')

    def create_layouts(self):
        main_layout = QVBoxLayout()

        # Search and list
        main_layout.addWidget(self.search_input)
        main_layout.addWidget(self.list_widget)

        # Form fields
        form_layout = QHBoxLayout()

        left_form = QVBoxLayout()
        left_form.addWidget(QLabel('Name:'))
        left_form.addWidget(self.textbox_name)
        left_form.addWidget(QLabel('IBAN:'))
        left_form.addWidget(self.textbox_iban)

        right_form = QVBoxLayout()
        right_form.addWidget(QLabel('Amount:'))
        right_form.addWidget(self.textbox_amount)
        right_form.addWidget(QLabel('Reference:'))
        right_form.addWidget(self.textbox_reference)

        form_layout.addLayout(left_form)
        form_layout.addLayout(right_form)

        main_layout.addLayout(form_layout)

        # QR code and buttons
        main_layout.addWidget(self.qr_label)

        buttons_layout = QHBoxLayout()
        buttons_layout.addWidget(self.button_save)
        buttons_layout.addWidget(self.button_delete)
        buttons_layout.addWidget(self.button_save_qr)
        main_layout.addLayout(buttons_layout)

        self.setLayout(main_layout)

    def connect_signals(self):
        self.list_widget.itemClicked.connect(self.load_selected_entry)
        self.search_input.textChanged.connect(self.filter_entries)
        self.button_save.clicked.connect(self.save_entry)
        self.button_delete.clicked.connect(self.delete_entry)
        self.button_save_qr.clicked.connect(self.save_qr)

    def load_entries(self):
        self.list_widget.clear()
        entries = self.db_manager.get_all_entries()

        for entry in entries:
            display_text = f'{entry.name}: {entry.iban} ({entry.amount}: {entry.reference})'
            item = QListWidgetItem(display_text)
            item.setData(Qt.ItemDataRole.UserRole, entry.id)
            self.list_widget.addItem(item)

    def load_selected_entry(self, item):
        entry_id = item.data(Qt.ItemDataRole.UserRole)
        entry = self.db_manager.get_entry_by_id(entry_id)

        if entry:
            self.textbox_name.setText(entry.name)
            self.textbox_iban.setText(entry.iban)
            self.textbox_amount.setText(str(entry.amount))
            self.textbox_reference.setText(entry.reference)
            self.update_qr_code()

    def save_entry(self):
        try:
            entry = Entry(
                id=None,
                name=self.textbox_name.text(),
                iban=self.textbox_iban.text(),
                amount=float(self.textbox_amount.text() or 0),
                reference=self.textbox_reference.text()
            )

            self.db_manager.add_entry(entry)
            self.load_entries()
            self.update_qr_code()
        except ValueError as e:
            print(f"Error saving entry: {e}")

    def delete_entry(self):
        selected_item = self.list_widget.currentItem()
        if selected_item:
            entry_id = selected_item.data(Qt.ItemDataRole.UserRole)
            if self.db_manager.delete_entry(entry_id):
                self.load_entries()

    def update_qr_code(self):
        try:
            entry = Entry(
                id=None,
                name=self.textbox_name.text(),
                iban=self.textbox_iban.text(),
                amount=float(self.textbox_amount.text() or 0),
                reference=self.textbox_reference.text()
            )

            qr_path = PathManager.get_temp_qr_path()
            if self.qr_generator.generate_qr(entry, qr_path):
                qr_pixmap = QPixmap(str(qr_path))
                if not qr_pixmap.isNull():
                    scaled_pixmap = qr_pixmap.scaled(
                        self.qr_label.size(),
                        Qt.AspectRatioMode.KeepAspectRatio,
                        Qt.TransformationMode.SmoothTransformation
                    )
                    self.qr_label.setPixmap(scaled_pixmap)
                else:
                    self.qr_label.clear()
            else:
                self.qr_label.clear()
        except Exception as e:
            print(f"Error updating QR code: {e}")
            self.qr_label.clear()

    def filter_entries(self):
        search_query = self.search_input.text().lower()
        for index in range(self.list_widget.count()):
            item = self.list_widget.item(index)
            if item:
                entry_text = item.text().lower()
                item.setHidden(search_query not in entry_text)

    def save_qr(self):
        today = date.today()
        downloads_path = Path.home() / 'Downloads'
        default_filename = f'PayPyQR_{self.textbox_name.text().replace(" ", "_")}_{today}.png'
        default_savepath = str(downloads_path / default_filename)

        file_path, _ = QFileDialog.getSaveFileName(
            self, 'Save QR Code', default_savepath, 'Images (*.png)'
        )

        if file_path:
            qr_pixmap = self.qr_label.pixmap()
            if qr_pixmap:
                qr_pixmap.save(file_path, 'PNG', quality=100)
            else:
                print("No QR code to save.")
