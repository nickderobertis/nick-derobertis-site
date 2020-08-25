from nick_derobertis_site.landing.config.cards import LANDING_CARD_MODELS
from nick_derobertis_site.landing.config.carousel import CAROUSEL_MODEL
from nick_derobertis_site.landing.config.skills import SKILLS_PANE_MODEL
from nick_derobertis_site.landing.page.landing_page_model import LandingPageModel

LANDING_PAGE_MODEL = LandingPageModel(
    card_models=LANDING_CARD_MODELS,
    carousel_model=CAROUSEL_MODEL,
    skills_model=SKILLS_PANE_MODEL,
    page_title="Nick DeRobertis' Personal Site",
    page_link_text='Home'
)