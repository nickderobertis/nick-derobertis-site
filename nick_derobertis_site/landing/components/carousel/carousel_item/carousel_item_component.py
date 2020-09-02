import param

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.general.widgets.button import PageButtonBase, PrimaryButton, PrimarySkillsButton
from .carousel_item_model import CarouselItemModel


class CarouselItemComponent(HTMLComponent):
    model = param.ClassSelector(class_=CarouselItemModel)
    buttons = param.List(class_=PageButtonBase)

    def __init__(self, **params):
        buttons = []
        for mod in params['model'].button_models:
            kwargs = dict(model=mod, services=params['services'])
            if mod.page_path == '#':
                buttons.append(PrimarySkillsButton(**kwargs))
            else:
                buttons.append(PrimaryButton(**kwargs))

        params['buttons'] = buttons
        super().__init__(**params)


