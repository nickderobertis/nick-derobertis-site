from nick_derobertis_site.general.widgets.button import PrimaryButton
from nick_derobertis_site.landing.components.carousel.carousel_item.carousel_item_model import CarouselItemModel
from nick_derobertis_site.landing.components.carousel.carousel_model import CarouselModel

CAROUSEL_RESEARCH_BUTTON = PrimaryButton(display_text='Research', page_path='research')
CAROUSEL_COURSES_BUTTON = PrimaryButton(display_text='Courses', page_path='courses')
CAROUSEL_SOFTWARE_BUTTON = PrimaryButton(display_text='Software Projects', page_path='software')
CAROUSEL_SKILLS_BUTTON = PrimaryButton(display_text='Skills', page_path='software')  # TODO: scroll to skills section

CAROUSEL_ITEM_MODELS = [
    CarouselItemModel(
        header_text='Finance Expert and Researcher',
        body_text='Focusing on market intervention, alternative assets, and behavioral finance',
        buttons=[CAROUSEL_RESEARCH_BUTTON],
        caption_div_classes=['carousel-caption', 'text-left'],
    ),
    CarouselItemModel(
        header_text='Effective Teacher and Communicator',
        body_text='Experienced in teaching hundreds of students across multiple courses both in-person and online',
        buttons=[CAROUSEL_COURSES_BUTTON],
    ),
    CarouselItemModel(
        header_text='Data Scientist and Full-Stack Software Engineer',
        body_text='Highly proficient at extracting insights from data. Maintainer of '
                  'dozens of open-source packages, experienced in creating full web applications',
        buttons=[CAROUSEL_SKILLS_BUTTON, CAROUSEL_SOFTWARE_BUTTON],
        caption_div_classes=['carousel-caption', 'text-right'],
    )
]

CAROUSEL_MODEL = CarouselModel(item_models=CAROUSEL_ITEM_MODELS)
