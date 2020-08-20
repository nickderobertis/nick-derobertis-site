from typing import List

import param

from nick_derobertis_site.common.page_model import PageModel
from nick_derobertis_site.software_page.software_banner.software_banner_component import SoftwareBannerComponent
from nick_derobertis_site.software_page.software_banner.software_banner_model import SoftwareBannerModel
from nick_derobertis_site.software_page.software_card.software_card_component import SoftwareCardComponent
from nick_derobertis_site.software_page.software_card.software_card_model import SoftwareCardModel


class SoftwarePageModel(PageModel):
    banner_model: SoftwareBannerModel = param.ClassSelector(class_=SoftwareBannerModel)
    banner: SoftwareBannerComponent = param.ClassSelector(class_=SoftwareBannerComponent)
    card_models: List[SoftwareCardModel] = param.List(class_=SoftwareCardModel)
    cards: List[SoftwareCardComponent] = param.List(class_=SoftwareCardComponent)

    def __init__(self, **params):
        params['banner'] = SoftwareBannerComponent(model=params['banner_model'])
        super().__init__(**params)
        self._set_cards()

    @param.depends('card_models', watch=True)
    def _set_cards(self):
        self.cards = [SoftwareCardComponent(model=mod) for mod in self.card_models]
