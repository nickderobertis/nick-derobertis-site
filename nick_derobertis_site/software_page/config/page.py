from nick_derobertis_site.software_page.config.banner import SOFTWARE_BANNER_MODEL
from nick_derobertis_site.software_page.config.card import SOFTWARE_CARD_MODELS
from nick_derobertis_site.software_page.software_page_model import SoftwarePageModel

SOFTWARE_PAGE_MODEL = SoftwarePageModel(
    page_title="Nick DeRobertis' Open-Source Software",
    page_link_text='Software',
    banner_model=SOFTWARE_BANNER_MODEL,
    card_models=SOFTWARE_CARD_MODELS,
)