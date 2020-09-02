import param

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.landing.page.landing_page_model import LandingPageModel
from nick_derobertis_site.landing.components.awards_pane.awards_pane_component import (
    AwardsPaneComponent,
)
from nick_derobertis_site.landing.components.card.card_component import CardComponent
from nick_derobertis_site.landing.components.carousel.carousel_component import (
    CarouselComponent,
)
from nick_derobertis_site.landing.components.contact_pane.contact_pane_component import (
    ContactPaneComponent,
)
from nick_derobertis_site.landing.components.skills_pane.skills_pane_component import (
    SkillsPaneComponent,
)
from nick_derobertis_site.landing.components.story_highlight_pane.story_highlight_pane_component import (
    StoryHighlightPaneComponent,
)


class LandingPageComponent(HTMLComponent):
    model = param.ClassSelector(class_=LandingPageModel)
    cards = param.List(class_=CardComponent)
    carousel = param.ClassSelector(class_=CarouselComponent)
    skills = param.ClassSelector(class_=SkillsPaneComponent)
    story_highlight = param.ClassSelector(class_=StoryHighlightPaneComponent)
    awards = param.ClassSelector(class_=AwardsPaneComponent)
    contact = param.ClassSelector(class_=ContactPaneComponent)

    def __init__(self, **params):
        params["carousel"] = CarouselComponent(
            model=params["model"].carousel_model, services=params["services"]
        )
        params["skills"] = SkillsPaneComponent(
            model=params["model"].skills_model, services=params["services"]
        )
        params["story_highlight"] = StoryHighlightPaneComponent(
            model=params["model"].story_highlight_model, services=params["services"]
        )
        params["contact"] = ContactPaneComponent(
            model=params["model"].contact_model, services=params["services"]
        )
        params["awards"] = AwardsPaneComponent(
            model=params["model"].awards_model, services=params["services"]
        )
        params["cards"] = [
            CardComponent(model=mod, services=params["services"])
            for mod in params["model"].card_models
        ]
        super().__init__(**params)
