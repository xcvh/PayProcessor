from setuptools import find_packages, setup

APP = ['src/main.py']
DATA_FILES = [
    ('', ['icon.icns']),
]
OPTIONS = {
    'argv_emulation': False,
    'packages': [
        'PyQt6',
        'segno',
        'sqlite3',
        'src',
        'src.gui',
        'src.models',
        'src.database',
        'src.services',
        'src.utils'
    ],
    'includes': [
        'src.gui.main_window',
        'src.models.models',
        'src.database.database_manager',
        'src.services.qr_generator',
        'src.utils.path_manager'
    ],
    'excludes': ['Carbon', 'AppKit', 'Tkinter', 'test'],
    'plist': {
        'CFBundleName': 'PayPyQR',
        'CFBundleShortVersionString': '1.2.0',
        'CFBundleVersion': '1.2.0',
        'CFBundleIdentifier': 'com.xcvh.paypyqr',
        'NSHumanReadableCopyright': 'No © 2024 Jeldo Meppen',
        'CFBundleSupportedPlatforms': ['MacOSX'],
        'CFBundleIconFile': 'icon.icns',
    },
    'arch': 'universal2',
}

setup(
    name='PayPyQR',
    version='1.2.0',
    packages=find_packages(),
    package_dir={'': '.'},
    include_package_data=True,
    app=APP,
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)
