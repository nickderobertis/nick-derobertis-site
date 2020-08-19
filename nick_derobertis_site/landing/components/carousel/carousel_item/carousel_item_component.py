import param

from nick_derobertis_site.common.component import HTMLComponent
from .carousel_item_model import CarouselItemModel


class CarouselItemComponent(HTMLComponent):
    model = param.ClassSelector(class_=CarouselItemModel)


