import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.landing.components.awards_pane.award.award_component import AwardComponent
from nick_derobertis_site.landing.components.awards_pane.award.award_model import AwardModel


class AwardsPaneModel(ComponentModel):
    award_models = param.List(class_=AwardModel)
    awards = param.List(class_=AwardComponent)

    def __init__(self, **params):
        params['awards'] = [AwardComponent(model=model) for model in params['award_models']]
        super().__init__(**params)