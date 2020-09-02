import os
import pathlib
import shutil

from plbuilder.cli import build_by_file_path
import derobertis_cv

SOURCES_ROOT = pathlib.Path(derobertis_cv.__file__).parent / 'plbuild' / 'sources' / 'document'
DOCUMENTS_OUT_PATH = pathlib.Path('Documents')
DOCUMENTS_MOVE_TO = pathlib.Path(__file__).parent.parent / 'assets' / 'pdfs' / 'generated'


def build_pdfs():
    _build_pdfs()
    _move_pdfs()


def _build_pdfs():
    for file in next(os.walk(SOURCES_ROOT))[2]:
        if file in ('__init__.py', 'professional_cv.py'):
            continue
        file_path = (SOURCES_ROOT / file).resolve()
        build_by_file_path(file_path)


def _move_pdfs():
    if not os.path.exists(DOCUMENTS_MOVE_TO):
        os.makedirs(DOCUMENTS_MOVE_TO)
    pdfs = [file for file in next(os.walk(DOCUMENTS_OUT_PATH))[2] if file.endswith('pdf')]
    for file in pdfs:
        file_path = DOCUMENTS_OUT_PATH / file
        shutil.copy(file_path, DOCUMENTS_MOVE_TO)


if __name__ == '__main__':
    build_pdfs()
