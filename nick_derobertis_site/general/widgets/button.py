from typing import Dict, Any, Sequence

import param
from bokeh.events import Event

from nick_derobertis_site.common.event_elem import EventElement
from nick_derobertis_site.common.providers import HasPageService


class ButtonBase(HasPageService, EventElement):
    display_text = param.String()
    page_path = param.String()
    button_css_classes: Sequence[str] = ('btn',)

    _rename = {**EventElement._rename, 'display_text': None, 'page_path': None}

    def __init__(self, **params):
        params['text'] = self._button_html(params)
        params['watch_events'] = ['click']
        if 'css_classes' not in params:
            params['css_classes'] = ['d-contents']
        self_params = dict(
            display_text=params.pop('display_text'),
            page_path=params.pop('page_path'),
        )
        super().__init__(**params)
        all_params = {**dict(self.get_param_values()), **self_params}
        param.Parameterized.__init__(self, **all_params)
        self.on('click', self.navigate_to_page)

    def _button_html(self, params: Dict[str, Any]) -> str:
        css_class_str = ' '.join(self.button_css_classes)
        return f'<button class="{css_class_str}">{params["display_text"]}</button>'

    def navigate_to_page(self, event: Event):
        self.page_service.navigate(self.page_path)


class PrimaryButton(ButtonBase):
    button_css_classes = tuple(ButtonBase.button_css_classes) + ('btn-primary',)
