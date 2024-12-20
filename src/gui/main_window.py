from PyQt6.QtWidgets import QMainWindow, QTabWidget, QApplication
from src.gui.excel_processor import ExcelProcessor
from src.gui.qr_payments import QRPayments
import sys

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ACEEU Payments Tool")
        self.resize(800, 600)

        # Tabs setup
        self.tabs = QTabWidget()
        self.setCentralWidget(self.tabs)

        # Add tabs
        self.tabs.addTab(QRPayments(), "EPC QR Code Generator")
        self.tabs.addTab(ExcelProcessor(), "Excel Processing")

        # Status bar
        self.statusBar().showMessage("Ready")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
