import param

from nick_derobertis_site.common.component import HTMLComponent
from .carousel_model import CarouselModel
from nick_derobertis_site.landing.components.carousel.carousel_item.carousel_item_component import (
    CarouselItemComponent,
)


class CarouselComponent(HTMLComponent):
    model = param.ClassSelector(class_=CarouselModel)
    items = param.List(class_=CarouselItemComponent)

    def __init__(self, **params):
        params["items"] = [
            CarouselItemComponent(model=model, services=params["services"])
            for model in params["model"].item_models
        ]
        super().__init__(**params)
