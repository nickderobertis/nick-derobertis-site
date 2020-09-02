import param

from nick_derobertis_site.landing.components.awards_pane.awards_pane_model import AwardsPaneModel
from nick_derobertis_site.landing.components.card.card_model import CardModel
from nick_derobertis_site.common.page_model import PageModel
from nick_derobertis_site.landing.components.carousel.carousel_model import CarouselModel
from nick_derobertis_site.landing.components.contact_pane.contact_pane_model import ContactPaneModel
from nick_derobertis_site.landing.components.skills_pane.skills_pane_model import SkillsPaneModel
from nick_derobertis_site.landing.components.story_highlight_pane.story_highlight_pane_model import \
    StoryHighlightPaneModel


class LandingPageModel(PageModel):
    card_models = param.List(class_=CardModel)
    carousel_model = param.ClassSelector(class_=CarouselModel)
    skills_model = param.ClassSelector(class_=SkillsPaneModel)
    story_highlight_model = param.ClassSelector(class_=StoryHighlightPaneModel)
    awards_model = param.ClassSelector(class_=AwardsPaneModel)
    contact_model = param.ClassSelector(class_=ContactPaneModel)
