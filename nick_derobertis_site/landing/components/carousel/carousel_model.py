import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.landing.components.carousel.carousel_item.carousel_item_model import CarouselItemModel


class CarouselModel(ComponentModel):
    item_models = param.List(class_=CarouselItemModel)

