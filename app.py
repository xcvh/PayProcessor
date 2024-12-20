import os
import sys
from PyQt6.QtWidgets import QApplication, QWidget, QVBoxLayout, QHBoxLayout, QListWidget, QLabel, QLineEdit, QPushButton, QFileDialog, QListWidgetItem
from PyQt6.QtGui import QPixmap
from PyQt6.QtCore import Qt
import sqlite3
import segno.helpers

def get_app_support_path():
    if getattr(sys, 'frozen', False):
        return os.path.join(os.path.expanduser('~/Library/Application Support'), 'PayProcessor')
    else:
        return os.path.dirname(os.path.abspath(__file__))

def get_database_path():
    app_support_path = get_app_support_path()
    os.makedirs(app_support_path, exist_ok=True)
    return os.path.join(app_support_path, 'entries.db')

class MyApp(QWidget):
    def __init__(self):
        self.db_path = get_database_path()
        super().__init__()
        self.initUI()

    def initUI(self):
        self.setWindowTitle('PayProcessor')
        self.setGeometry(100, 100, 600, 400)

        self.list_widget = QListWidget()
        self.load_entries()
        self.list_widget.itemClicked.connect(self.load_selected_entry)

        self.label_name = QLabel('Name:')
        self.textbox_name = QLineEdit()

        self.label_iban = QLabel('IBAN:')
        self.textbox_iban = QLineEdit()

        self.label_amount = QLabel('Amount:')
        self.textbox_amount = QLineEdit()

        self.label_reference = QLabel('Reference:')
        self.textbox_reference = QLineEdit()

        self.button_save = QPushButton('Save Entry')
        self.button_save.clicked.connect(self.save_entry)

        self.button_delete = QPushButton('Delete Entry')
        self.button_delete.clicked.connect(self.delete_entry)

        self.button_save_qr = QPushButton('Save QR Code')
        self.button_save_qr.clicked.connect(self.save_qr)

        self.qr_label = QLabel()
        self.qr_label.setFixedSize(200, 200)
        self.qr_label.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText('Search...')
        self.search_input.textChanged.connect(self.filter_entries)

        input_layout_left = QVBoxLayout()
        input_layout_left.addWidget(self.label_name)
        input_layout_left.addWidget(self.textbox_name)
        input_layout_left.addWidget(self.label_iban)
        input_layout_left.addWidget(self.textbox_iban)

        input_layout_right = QVBoxLayout()
        input_layout_right.addWidget(self.label_amount)
        input_layout_right.addWidget(self.textbox_amount)
        input_layout_right.addWidget(self.label_reference)
        input_layout_right.addWidget(self.textbox_reference)

        buttons_layout = QHBoxLayout()
        buttons_layout.addWidget(self.button_save)
        buttons_layout.addWidget(self.button_delete)
        buttons_layout.addWidget(self.button_save_qr)

        main_layout = QVBoxLayout()
        main_layout.addWidget(self.search_input)
        main_layout.addWidget(self.list_widget)
        main_layout.addLayout(input_layout_left)
        main_layout.addLayout(input_layout_right)
        main_layout.addWidget(self.qr_label)
        main_layout.addLayout(buttons_layout)

        self.setLayout(main_layout)

    def load_entries(self):
        self.list_widget.clear()

        connection = sqlite3.connect(self.db_path)
        cursor = connection.cursor()

        cursor.execute('''CREATE TABLE IF NOT EXISTS entries
                          (id INTEGER PRIMARY KEY AUTOINCREMENT,
                           name TEXT,
                           iban TEXT,
                           amount REAL,
                           reference TEXT)''')

        cursor.execute('SELECT id, name, iban, amount, reference FROM entries')
        entries = cursor.fetchall()
        connection.close()

        for entry in entries:
            display_text = f'{entry[1]}: {entry[2]} ({entry[3]}: {entry[4]})'
            item = QListWidgetItem(display_text)
            item.setData(Qt.ItemDataRole.UserRole, entry[0])  # Use Qt.ItemDataRole.UserRole instead of magic number
            self.list_widget.addItem(item)

    def load_selected_entry(self, item):
        entry_id = item.data(Qt.ItemDataRole.UserRole)  # Use Qt.ItemDataRole.UserRole
        if entry_id is None:
            print("No ID associated with the selected item")
            return

        connection = sqlite3.connect(self.db_path)
        cursor = connection.cursor()
        cursor.execute('SELECT name, iban, amount, reference FROM entries WHERE id = ?', (entry_id,))
        entry = cursor.fetchone()
        connection.close()

        if entry:
            self.textbox_name.setText(entry[0])
            self.textbox_iban.setText(entry[1])
            self.textbox_amount.setText(str(entry[2]))
            self.textbox_reference.setText(entry[3])

            self.update_qr_code()

    def save_entry(self):
        name = self.textbox_name.text()
        iban = self.textbox_iban.text()
        amount = float(self.textbox_amount.text())
        reference = self.textbox_reference.text()

        connection = sqlite3.connect(self.db_path)
        cursor = connection.cursor()
        cursor.execute('INSERT INTO entries (name, iban, amount, reference) VALUES (?, ?, ?, ?)', (name, iban, amount, reference))
        connection.commit()
        connection.close()

        self.load_entries()
        self.update_qr_code()

    def delete_entry(self):
        selected_item = self.list_widget.currentItem()
        if selected_item:
            entry_id = selected_item.data(Qt.ItemDataRole.UserRole)  # Use Qt.ItemDataRole.UserRole
            if entry_id is None:
                print("No ID associated with the selected item")
                return

            connection = sqlite3.connect(self.db_path)
            cursor = connection.cursor()
            cursor.execute('DELETE FROM entries WHERE id = ?', (entry_id,))
            connection.commit()
            connection.close()

            self.load_entries()

    def update_qr_code(self):
        try:
            name = self.textbox_name.text() or ''
            iban = self.textbox_iban.text() or ''
            reference = self.textbox_reference.text() or ''
            qr_save_path = os.path.join(get_app_support_path(), 'qr.png')

            # Handle amount carefully
            try:
                amount = float(self.textbox_amount.text() or '0')
            except ValueError:
                amount = 0.0

            # Only generate QR if essential details are present
            if name and iban:
                qr_code = segno.helpers.make_epc_qr(
                    name=name,
                    iban=iban,
                    amount=amount,
                    text=reference or None  # Use None if reference is empty
                )
                qr_code.save(qr_save_path, scale=10)

                qr_pixmap = QPixmap(qr_save_path)

                if not qr_pixmap.isNull():
                    scaled_pixmap = qr_pixmap.scaled(
                        self.qr_label.size(),
                        Qt.AspectRatioMode.KeepAspectRatio,
                        Qt.TransformationMode.SmoothTransformation
                    )
                    self.qr_label.setPixmap(scaled_pixmap)
            else:
                # Clear the QR code label if insufficient information
                self.qr_label.clear()
        except Exception as e:
            print(f"Error generating QR code: {e}")
            self.qr_label.clear()

    def filter_entries(self):
        search_query = self.search_input.text().lower()
        for index in range(self.list_widget.count()):
            item = self.list_widget.item(index)
            if item is not None:  # Sicherstellen, dass item nicht None ist
                entry_text = item.text().lower() if item.text() else ""
                item.setHidden(search_query not in entry_text)

    def save_qr(self):
        default_filename = f'{self.textbox_name.text().replace(" ", "_")}_PayProcessor.png'
        file_path, _ = QFileDialog.getSaveFileName(self, 'Save QR Code', default_filename, 'Images (*.png)')
        if file_path:
            qr_pixmap = self.qr_label.pixmap()
            # Save the QR code pixmap with better quality settings (HD)
            if qr_pixmap is not None:
                qr_pixmap.save(file_path, 'PNG', quality=100)
            else:
                print("No QR code to save.")

def main():
    app = QApplication(sys.argv)
    myapp = MyApp()
    myapp.show()
    sys.exit(app.exec())

if __name__ == '__main__':
    main()
