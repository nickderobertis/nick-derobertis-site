from nick_derobertis_site.courses_page.config.page import COURSES_PAGE_MODEL
from nick_derobertis_site.courses_page.courses_page_component import CoursesPageComponent
from nick_derobertis_site.landing.config.page import LANDING_PAGE_MODEL
from nick_derobertis_site.landing.page.landing_page_component import LandingPageComponent
from nick_derobertis_site.loading_page.config import LOADING_PAGE_MODEL
from nick_derobertis_site.loading_page.loading_page_component import LoadingPageComponent
from nick_derobertis_site.research_page.config.page import RESEARCH_PAGE_MODEL
from nick_derobertis_site.research_page.research_page_component import ResearchPageComponent
from nick_derobertis_site.software_page.config.page import SOFTWARE_PAGE_MODEL
from nick_derobertis_site.software_page.software_page_component import SoftwarePageComponent
from nick_derobertis_site.story_page.config.page import STORY_PAGE_MODEL
from nick_derobertis_site.story_page.story_page_component import StoryPageComponent

LANDING_PAGE: LandingPageComponent = LandingPageComponent(model=LANDING_PAGE_MODEL)
STORY_PAGE: StoryPageComponent = StoryPageComponent(model=STORY_PAGE_MODEL)
RESEARCH_PAGE: ResearchPageComponent = ResearchPageComponent(model=RESEARCH_PAGE_MODEL)
SOFTWARE_PAGE: SoftwarePageComponent = SoftwarePageComponent(model=SOFTWARE_PAGE_MODEL)
COURSES_PAGE: CoursesPageComponent = CoursesPageComponent(model=COURSES_PAGE_MODEL)
LOADING_PAGE: LoadingPageComponent = LoadingPageComponent(model=LOADING_PAGE_MODEL)

ROUTES = {
    'home': LANDING_PAGE,
    'story': STORY_PAGE,
    'research': RESEARCH_PAGE,
    'software': SOFTWARE_PAGE,
    'courses': COURSES_PAGE,
    # 'loading': LOADING_PAGE,  # uncomment to work on loading page without it going away
}
