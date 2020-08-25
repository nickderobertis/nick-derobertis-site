
from derobertis_cv.pldata.courses.main import get_courses

from nick_derobertis_site.courses_page.course_pane.course_pane_model import CoursePaneModel

ALL_COURSE_MODELS = get_courses()

COURSE_PANE_MODELS = [CoursePaneModel.from_course_model(mod) for mod in ALL_COURSE_MODELS]