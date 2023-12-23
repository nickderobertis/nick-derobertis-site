import os
import pathlib
import shutil

import derobertis_cv
import derobertis_cv.pldata.cv as cv
from plbuilder.cli import build_by_file_path

SOURCES_ROOT = (
    pathlib.Path(derobertis_cv.__file__).parent / "plbuild" / "sources" / "document"
)
DOCUMENTS_OUT_PATH = pathlib.Path("Documents")
DOCUMENTS_MOVE_TO = (
    pathlib.Path(__file__).parent.parent.parent
    / "frontend"
    / "nick-derobertis-site"
    / "src"
    / "assets"
    / "pdfs"
    / "generated"
)


def build_pdfs():
    _build_pdfs()
    _move_pdfs()


def _build_pdfs():
    file_path = (SOURCES_ROOT / "fin_model_syllabus.py").resolve()
    build_by_file_path(str(file_path))

    professional_model = cv.CV_MODELS[cv.CVTypes.PROFESSIONAL]
    build_cv_models = (professional_model,)
    cv.build_cvs(build_cv_models, str(DOCUMENTS_OUT_PATH))


def _move_pdfs():
    if not os.path.exists(DOCUMENTS_MOVE_TO):
        os.makedirs(DOCUMENTS_MOVE_TO)
    pdfs = [
        file for file in next(os.walk(DOCUMENTS_OUT_PATH))[2] if file.endswith("pdf")
    ]
    for file in pdfs:
        file_path = DOCUMENTS_OUT_PATH / file
        shutil.copy(file_path, DOCUMENTS_MOVE_TO)


if __name__ == "__main__":
    build_pdfs()
