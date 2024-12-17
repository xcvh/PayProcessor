remove-old-build:
    rm -rf build dist

rebuild: remove-old-build
    python setup.py py2app

build:
    python setup.py py2app
