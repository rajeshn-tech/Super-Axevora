
import sys

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QApplication,
    QMainWindow,
    QWidget,
    QLabel,
    QVBoxLayout,
    QToolBar,
    QStatusBar,
)


class OpenCompWindow(QMainWindow):
    def __init__(self):
        super().__init__()

        self.setWindowTitle("OpenComp")
        self.resize(1280, 800)

        self._create_menu()
        self._create_toolbar()
        self._create_workspace()
        self._create_status_bar()

    def _create_menu(self):
        file_menu = self.menuBar().addMenu("&File")
        file_menu.addAction("Open Image...", self.open_image)
        file_menu.addSeparator()
        file_menu.addAction("Exit", self.close)

        self.menuBar().addMenu("&Edit")
        self.menuBar().addMenu("&Workspace")
        self.menuBar().addMenu("&Help")

    def _create_toolbar(self):
        toolbar = QToolBar("Main Toolbar")
        toolbar.setMovable(False)
        self.addToolBar(toolbar)

        toolbar.addAction("Open Image", self.open_image)

    def _create_workspace(self):
        workspace = QWidget()
        layout = QVBoxLayout(workspace)

        self.viewer_label = QLabel(
            "OpenComp\n\nImage Viewer Workspace\n\n"
            "File > Open Image se image load karein."
        )
        self.viewer_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.viewer_label.setStyleSheet(
            "background-color: #202124;"
            "color: #e8eaed;"
            "font-size: 18px;"
            "border: 1px solid #444;"
        )

        layout.addWidget(self.viewer_label)
        self.setCentralWidget(workspace)

    def _create_status_bar(self):
        status = QStatusBar()
        status.showMessage("OpenComp ready")
        self.setStatusBar(status)

    def open_image(self):
        from PySide6.QtWidgets import QFileDialog, QMessageBox

        filename, _ = QFileDialog.getOpenFileName(
            self,
            "Open Image",
            "",
            "Images (*.png *.jpg *.jpeg *.bmp *.tif *.tiff);;All Files (*)",
        )

        if not filename:
            return

        QMessageBox.information(
            self,
            "Image Loading",
            "Image selection received:\n" + filename
            + "\n\nActual image display will be implemented next.",
        )


def main():
    app = QApplication(sys.argv)
    window = OpenCompWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
