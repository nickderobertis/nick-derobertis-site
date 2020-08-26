from typing import Dict, Any, Sequence

import param
from bokeh.events import Event
from panel.widgets import Widget

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.common.event_elem import EventElement
from nick_derobertis_site.common.providers.page_service import HasPageService
from nick_derobertis_site.common.providers.pdf import HasPDFModel
from nick_derobertis_site.general.utils import PLACEHOLDER_PDF


class PageButtonBase(HasPageService, EventElement):
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
        if self.page_path == '#':
            return
        self.page_service.navigate(self.page_path)


class PDFButtonBase(HTMLComponent):
    """
    :Notes:

        This requires jQuery to work, it is included in the home
        template targeting the class has-pdf
    """
    _default_button_css_classes: Sequence[str] = ('btn',)
    display_text = param.String()
    button_css_classes: str = param.List(class_=str, default=list(_default_button_css_classes))
    pdf_src: str = param.String(default=PLACEHOLDER_PDF)
    template_str = '<button class="has-pdf {{ button_css_classes | join(" ") }}" data-pdf-src="{{ pdf_src }}">{{ display_text }}</button>'

    def __init__(self, **params):
        if 'button_css_classes' not in params:
            params['button_css_classes'] = list(self._default_button_css_classes)
        else:
            params['button_css_classes'].extend(self._default_button_css_classes)
        super().__init__(**params)


class SkillsButton(PageButtonBase):
    button_css_classes = tuple(PageButtonBase.button_css_classes) + ('scroll-to-skills',)


class PrimaryButton(PageButtonBase):
    button_css_classes = tuple(PageButtonBase.button_css_classes) + ('btn-primary',)


class PrimarySkillsButton(SkillsButton):
    button_css_classes = tuple(SkillsButton.button_css_classes) + ('btn-primary',)


class NarrowPrimaryButton(PrimaryButton):
    button_css_classes = tuple(PrimaryButton.button_css_classes) + ('btn-narrow',)


class PrimaryPDFButton(PDFButtonBase):
    _default_button_css_classes = tuple(PDFButtonBase._default_button_css_classes) + ('btn-primary',)


class NarrowPrimaryPDFButton(PrimaryPDFButton):
    _default_button_css_classes = tuple(PrimaryPDFButton._default_button_css_classes) + ('btn-narrow',)


