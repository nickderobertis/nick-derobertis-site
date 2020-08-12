from nick_derobertis_site.landing.config.page import LANDING_PAGE_MODEL
from nick_derobertis_site.landing.page.landing_page_component import LandingPageComponent

LANDING_PAGE: LandingPageComponent = LandingPageComponent(LANDING_PAGE_MODEL)

PAGES = [
    LANDING_PAGE,
]