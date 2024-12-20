from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QListWidget, QLabel,
    QPushButton, QFileDialog, QListWidgetItem, QSplitter
)
from PyQt6.QtGui import QPixmap
from PyQt6.QtCore import Qt
from datetime import date
from pathlib import Path

from src.models.models import Recipient, IBAN, Payment
from src.database.database_manager import DatabaseManager
from src.services.qr_generator import QRGenerator
from src.utils.path_manager import PathManager

class MainWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.db_manager = DatabaseManager(PathManager.get_database_path())
        self.qr_generator = QRGenerator()
        self.current_recipient = None
        self.current_iban = None
        self.current_payment = None
        self.init_ui()

    def init_ui(self):
        self.setWindowTitle('PayPyQR')
        self.setGeometry(100, 100, 800, 600)

        # Create main layout
        main_layout = QHBoxLayout()

        # Create lists
        self.recipients_list = QListWidget()
        self.ibans_list = QListWidget()
        self.payments_list = QListWidget()

        # Create QR display
        self.qr_label = QLabel()
        self.qr_label.setFixedSize(200, 200)
        self.qr_label.setAlignment(Qt.AlignmentFlag.AlignCenter)

        # Create save QR button
        self.button_save_qr = QPushButton('Save QR Code')

        # Create splitter for main layout
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # Left panel - Recipients
        recipients_widget = QWidget()
        recipients_layout = QVBoxLayout(recipients_widget)
        recipients_layout.addWidget(QLabel("Recipients"))
        recipients_layout.addWidget(self.recipients_list)

        # Right panel - IBANs and Payments
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)

        # IBANs section
        ibans_widget = QWidget()
        ibans_layout = QVBoxLayout(ibans_widget)
        ibans_layout.addWidget(QLabel("IBANs"))
        ibans_layout.addWidget(self.ibans_list)

        # Payments section
        payments_widget = QWidget()
        payments_layout = QVBoxLayout(payments_widget)
        payments_layout.addWidget(QLabel("Payments"))
        payments_layout.addWidget(self.payments_list)

        # Add IBANs and Payments to right layout
        right_layout.addWidget(ibans_widget)
        right_layout.addWidget(payments_widget)

        # QR section
        qr_widget = QWidget()
        qr_layout = QVBoxLayout(qr_widget)
        qr_layout.addWidget(self.qr_label)
        qr_layout.addWidget(self.button_save_qr)
        right_layout.addWidget(qr_widget)

        # Add widgets to splitter
        splitter.addWidget(recipients_widget)
        splitter.addWidget(right_panel)

        # Set initial splitter sizes (40% - 60%)
        splitter.setSizes([320, 480])

        main_layout.addWidget(splitter)
        self.setLayout(main_layout)

        # Connect signals
        self.connect_signals()

        # Load initial data
        self.load_recipients()

    def connect_signals(self):
        self.recipients_list.itemClicked.connect(self.load_recipient_data)
        self.ibans_list.itemClicked.connect(self.load_iban_payments)
        self.payments_list.itemClicked.connect(self.load_payment_qr)
        self.button_save_qr.clicked.connect(self.save_qr)

    def load_recipients(self):
        self.recipients_list.clear()
        recipients = self.db_manager.get_all_recipients()

        for recipient in recipients:
            item = QListWidgetItem(recipient.name)
            item.setData(Qt.ItemDataRole.UserRole, recipient.id)
            self.recipients_list.addItem(item)

    def load_recipient_data(self, item):
        recipient_id = item.data(Qt.ItemDataRole.UserRole)
        self.current_recipient = self.db_manager.get_recipient_with_ibans(recipient_id)

        # Clear and update IBANs list
        self.ibans_list.clear()
        if self.current_recipient and self.current_recipient.ibans:
            for iban in self.current_recipient.ibans:
                item = QListWidgetItem(iban.iban)
                item.setData(Qt.ItemDataRole.UserRole, iban.id)
                self.ibans_list.addItem(item)

        # Load all payments for this recipient
        self.load_all_recipient_payments()

    def load_all_recipient_payments(self):
        self.payments_list.clear()
        if self.current_recipient and self.current_recipient.ibans:
            for iban in self.current_recipient.ibans:
                iban_data = self.db_manager.get_iban_with_payments(iban.id)
                if iban_data and iban_data.payments:
                    for payment in iban_data.payments:
                        self.add_payment_to_list(payment, iban_data.iban)

    def load_iban_payments(self, item):
        iban_id = item.data(Qt.ItemDataRole.UserRole)
        self.current_iban = self.db_manager.get_iban_with_payments(iban_id)

        # Clear and update payments list
        self.payments_list.clear()
        if self.current_iban and self.current_iban.payments:
            for payment in self.current_iban.payments:
                self.add_payment_to_list(payment, self.current_iban.iban)

    def add_payment_to_list(self, payment: Payment, iban: str):
        display_text = f"{payment.amount} EUR - {payment.reference} ({iban})"
        item = QListWidgetItem(display_text)
        item.setData(Qt.ItemDataRole.UserRole, {
            'payment_id': payment.id,
            'amount': payment.amount,
            'reference': payment.reference,
            'iban': iban
        })
        self.payments_list.addItem(item)

    def load_payment_qr(self, item):
        payment_data = item.data(Qt.ItemDataRole.UserRole)
        self.current_payment = payment_data
        self.update_qr_code()

    def update_qr_code(self):
        if not self.current_payment:
            self.qr_label.clear()
            return

        try:
            qr_path = PathManager.get_temp_qr_path()
            # Note: You'll need to update your QR generator to work with the new data structure
            if self.qr_generator.generate_qr({
                'name': self.current_recipient.name,
                'iban': self.current_payment['iban'],
                'amount': self.current_payment['amount'],
                'reference': self.current_payment['reference']
            }, qr_path):
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
        except Exception as e:
            print(f"Error updating QR code: {e}")
            self.qr_label.clear()

    def save_qr(self):
        if not self.current_payment:
            return

        today = date.today()
        downloads_path = Path.home() / 'Downloads'
        default_filename = f'PayPyQR_{self.current_recipient.name.replace(" ", "_")}_{today}.png'
        default_savepath = str(downloads_path / default_filename)

        file_path, _ = QFileDialog.getSaveFileName(
            self, 'Save QR Code', default_savepath, 'Images (*.png)'
        )

        if file_path:
            qr_pixmap = self.qr_label.pixmap()
            if qr_pixmap:
                qr_pixmap.save(file_path, 'PNG', quality=100)
