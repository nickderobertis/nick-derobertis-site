from nick_derobertis_site.research_page.config.banner import RESEARCH_BANNER_MODEL
from nick_derobertis_site.research_page.config.panes import RESEARCH_PANE_MODELS
from nick_derobertis_site.research_page.research_page_model import ResearchPageModel

RESEARCH_PAGE_MODEL = ResearchPageModel(
    page_title="Nick DeRobertis' Research Works",
    page_link_text='Research',
    pane_models=RESEARCH_PANE_MODELS,
    banner_model=RESEARCH_BANNER_MODEL,
)