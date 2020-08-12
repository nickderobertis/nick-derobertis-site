from nick_derobertis_site.landing.config.page import LANDING_PAGE_MODEL
from nick_derobertis_site.landing.page.landing_page_component import LandingPageComponent
from nick_derobertis_site.story_page.config.page import STORY_PAGE_MODEL
from nick_derobertis_site.story_page.story_page_component import StoryPageComponent

LANDING_PAGE: LandingPageComponent = LandingPageComponent(model=LANDING_PAGE_MODEL)
STORY_PAGE: StoryPageComponent = StoryPageComponent(model=STORY_PAGE_MODEL)

PAGES = [
    LANDING_PAGE,
    STORY_PAGE
]