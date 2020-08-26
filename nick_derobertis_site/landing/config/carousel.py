import os
import pathlib

from nick_derobertis_site.general.config import IMAGES_PATH
from nick_derobertis_site.general.models.image import ImageModel
from nick_derobertis_site.general.widgets.button import PrimaryButton, PrimarySkillsButton
from nick_derobertis_site.landing.components.carousel.carousel_item.carousel_item_model import CarouselItemModel
from nick_derobertis_site.landing.components.carousel.carousel_model import CarouselModel

CAROUSEL_RESEARCH_BUTTON = PrimaryButton(display_text='Research', page_path='research')
CAROUSEL_COURSES_BUTTON = PrimaryButton(display_text='Courses', page_path='courses')
CAROUSEL_SOFTWARE_BUTTON = PrimaryButton(display_text='Software Projects', page_path='software')
CAROUSEL_SKILLS_BUTTON = PrimarySkillsButton(display_text='Skills', page_path='#')

DATA_SCIENCE_BANNER_IMAGE_MODEL = ImageModel(image_path=os.path.join(IMAGES_PATH, 'data-science-banner.jpg'))
RESEARCH_IMAGE_MODEL = ImageModel(image_path=os.path.join(IMAGES_PATH, 'finance-research-banner.jpg'))
TEACHING_IMAGE_MODEL = ImageModel(image_path=os.path.join(IMAGES_PATH, 'teaching-banner.jpg'))

CAROUSEL_ITEM_MODELS = [
    CarouselItemModel(
        header_text='Finance Expert and Researcher',
        body_text='Focusing on market intervention, alternative assets, and behavioral finance',
        buttons=[CAROUSEL_RESEARCH_BUTTON],
        caption_div_classes=['carousel-caption', 'text-left'],
        image=RESEARCH_IMAGE_MODEL,
    ),
    CarouselItemModel(
        header_text='Effective Teacher and Communicator',
        body_text='Experienced in teaching hundreds of students across multiple courses both in-person and online',
        buttons=[CAROUSEL_COURSES_BUTTON],
        image=TEACHING_IMAGE_MODEL,
    ),
    CarouselItemModel(
        header_text='Data Scientist and Full-Stack Software Engineer',
        body_text='Highly proficient at extracting insights from data. Maintainer of '
                  'dozens of open-source packages, experienced in creating full web applications',
        buttons=[CAROUSEL_SKILLS_BUTTON, CAROUSEL_SOFTWARE_BUTTON],
        caption_div_classes=['carousel-caption', 'text-right'],
        image=DATA_SCIENCE_BANNER_IMAGE_MODEL,
    )
]

CAROUSEL_MODEL = CarouselModel(item_models=CAROUSEL_ITEM_MODELS)
