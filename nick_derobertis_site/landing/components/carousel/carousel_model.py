import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.landing.components.carousel.carousel_item.carousel_item_component import CarouselItemComponent
from nick_derobertis_site.landing.components.carousel.carousel_item.carousel_item_model import CarouselItemModel


class CarouselModel(ComponentModel):
    item_models = param.List(class_=CarouselItemModel)
    items = param.List(class_=CarouselItemComponent)

    def __init__(self, **params):
        params['items'] = [CarouselItemComponent(model=model) for model in params['item_models']]
        super().__init__(**params)
