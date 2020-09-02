import param

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.general.widgets.button import PageButtonBase, PrimaryButton, PrimarySkillsButton
from .carousel_item_model import CarouselItemModel


class CarouselItemComponent(HTMLComponent):
    model = param.ClassSelector(class_=CarouselItemModel)
    buttons = param.List(class_=PageButtonBase)

    def __init__(self, **params):
        if not params['model'].buttons_are_for_skills:
            button_cls = PrimaryButton
        else:
            button_cls = PrimarySkillsButton
        params['buttons'] = [button_cls(model=mod) for mod in params['model'].button_models]
        super().__init__(**params)


