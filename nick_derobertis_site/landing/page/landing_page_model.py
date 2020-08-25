import param

from nick_derobertis_site.landing.components.card.card_component import CardComponent
from nick_derobertis_site.landing.components.card.card_model import CardModel
from nick_derobertis_site.common.page_model import PageModel
from nick_derobertis_site.landing.components.carousel.carousel_component import CarouselComponent
from nick_derobertis_site.landing.components.carousel.carousel_model import CarouselModel
from nick_derobertis_site.landing.components.skills_pane.skills_pane_component import SkillsPaneComponent
from nick_derobertis_site.landing.components.skills_pane.skills_pane_model import SkillsPaneModel


class LandingPageModel(PageModel):
    card_models = param.List(class_=CardModel)
    cards = param.List(class_=CardComponent)
    carousel_model = param.ClassSelector(class_=CarouselModel)
    carousel = param.ClassSelector(class_=CarouselComponent)
    skills_model = param.ClassSelector(class_=SkillsPaneModel)
    skills = param.ClassSelector(class_=SkillsPaneComponent)

    def __init__(self, **params):
        params['carousel'] = CarouselComponent(model=params['carousel_model'])
        params['skills'] = SkillsPaneComponent(model=params['skills_model'])
        super().__init__(**params)
        self._set_cards()


    @param.depends('card_models', watch=True)
    def _set_cards(self):
        self.cards = [CardComponent(model=mod) for mod in self.card_models]