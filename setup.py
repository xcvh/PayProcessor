from setuptools import find_packages, setup

APP = ['src/main.py']
DATA_FILES = [
    ('', ['icon.icns']),  # Add your icon file
]
OPTIONS = {
    'argv_emulation': False,
    'packages': ['PyQt6', 'segno', 'sqlite3'],
    'excludes': ['Carbon', 'AppKit', 'Tkinter', 'test'],
    'plist': {
        'CFBundleName': 'PayPyQR',
        'CFBundleShortVersionString': '1.2.0',
        'CFBundleVersion': '1.2.0',
        'CFBundleIdentifier': 'com.xcvh.paypyqr',
        'NSHumanReadableCopyright': 'No © 2024 Jeldo Meppen',
        'CFBundleSupportedPlatforms': ['MacOSX'],
        'CFBundleIconFile': 'icon.icns',  # Name of your icon file
    },
    'arch': 'universal2',
}

setup(
    app=APP,
    data_files=DATA_FILES,
    packages=find_packages(),
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)
