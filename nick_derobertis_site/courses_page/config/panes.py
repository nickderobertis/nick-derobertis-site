
from derobertis_cv.pldata.courses.main import get_courses

from nick_derobertis_site.courses_page.course_pane.course_pane_model import CoursePaneModel
from nick_derobertis_site.general.config import GENERATED_PDFS_PATH
from nick_derobertis_site.general.models.pdf import PDFModel

ALL_COURSE_MODELS = get_courses()

FIN_MODEL_SYLLABUS_PDF_MODEL = PDFModel(pdf_path=str(GENERATED_PDFS_PATH / 'Financial Modeling Syllabus.pdf'))

COURSE_PANE_MODELS = [CoursePaneModel.from_course_model(mod) for mod in ALL_COURSE_MODELS]

for cp in COURSE_PANE_MODELS:
    if cp.title == 'Financial Modeling':
        cp.pdf = FIN_MODEL_SYLLABUS_PDF_MODEL
        cp.pdf_src = cp.pdf.src
        break
