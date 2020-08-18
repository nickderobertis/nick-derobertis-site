import param

from nick_derobertis_site.common.model import ComponentModel


class CardModel(ComponentModel):
    heading = param.String()
    body_text = param.String()
    icon_classes = param.List(class_=str, default=['fas', 'fa-chart-bar', 'fa-5x'])
    link = param.String(default=None)
    link_display_text = param.String(default=None)

    @property
    def icon_class_str(self) -> str:
        return ' '.join(self.icon_classes)
