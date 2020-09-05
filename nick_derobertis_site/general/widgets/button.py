from typing import Dict, Any, Sequence

import param
from bokeh.events import Event
from panel.widgets import Widget

from awesome_panel_extensions.model import ComponentModel
from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.common.event_elem import EventElement
from nick_derobertis_site.common.providers.pdf import HasPDFModel
from nick_derobertis_site.general.utils import PLACEHOLDER_PDF


class ButtonModel(ComponentModel):
    display_text = param.String()
    page_path = param.String()


class PageButtonBase(EventElement):
    model: ButtonModel = param.ClassSelector(class_=ButtonModel)
    button_css_classes: Sequence[str] = ('btn',)

    _rename = {**EventElement._rename, 'model': None}

    def __init__(self, **params):
        params['text'] = self._button_html(params)
        params['watch_events'] = ['click']
        if 'css_classes' not in params:
            params['css_classes'] = ['d-contents']
        self_params = dict(
            model=params.pop('model'),
        )
        super().__init__(**params)
        all_params = {**dict(self.get_param_values()), **self_params}
        param.Parameterized.__init__(self, **all_params)
        self.on('click', self.navigate_to_page)

    def _button_html(self, params: Dict[str, Any]) -> str:
        css_class_str = ' '.join(self.button_css_classes)
        return f'<button class="{css_class_str}">{params["model"].display_text}</button>'

    def navigate_to_page(self, event: Event):
        if self.model.page_path == '#':
            return
        self.services.page_service.navigate(self.model.page_path)


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


class PrimaryRaisedButton(PrimaryButton):
    button_css_classes = tuple(PrimaryButton.button_css_classes) + ('btn-raised',)


class PrimaryOutlineButton(PrimaryButton):
    button_css_classes = tuple(PrimaryButton.button_css_classes) + ('border', 'border-primary')


class PrimaryOutlineSkillsButton(PrimarySkillsButton):
    button_css_classes = tuple(PrimarySkillsButton.button_css_classes) + ('border', 'border-primary')


class NarrowPrimaryButton(PrimaryButton):
    button_css_classes = tuple(PrimaryButton.button_css_classes) + ('btn-narrow',)


class PrimaryPDFButton(PDFButtonBase):
    _default_button_css_classes = tuple(PDFButtonBase._default_button_css_classes) + ('btn-primary',)


class PrimaryOutlinePDFButton(PrimaryPDFButton):
    _default_button_css_classes = tuple(PrimaryPDFButton._default_button_css_classes) + ('border', 'border-primary')


class NarrowPrimaryPDFButton(PrimaryPDFButton):
    _default_button_css_classes = tuple(PrimaryPDFButton._default_button_css_classes) + ('btn-narrow',)


class RaisedPrimaryPDFButton(PrimaryPDFButton):
    _default_button_css_classes = tuple(PrimaryPDFButton._default_button_css_classes) + ('btn-raised',)
