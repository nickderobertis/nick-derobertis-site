import os

from nick_derobertis_site.courses_page.courses_banner.courses_banner_model import CoursesBannerModel
from nick_derobertis_site.general.config import IMAGES_PATH
from nick_derobertis_site.general.models.image import ImageModel

COURSES_BANNER_IMAGE_MODEL = ImageModel(image_path=os.path.join(IMAGES_PATH, 'courses-banner.jpg'))

COURSES_BANNER_MODEL = CoursesBannerModel(
    header_text='Courses',
    sub_text="I've taught hundreds of students at multiple universities. Browse my courses below.",
    image=COURSES_BANNER_IMAGE_MODEL
)
