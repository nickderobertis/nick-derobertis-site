from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.landing.page.landing_page_model import LandingPageModel


class LandingPageComponent(HTMLComponent):

    def __init__(self, model: LandingPageModel, **kwargs):
        self.model = model
        super().__init__(**kwargs)


