from typing import List

import param

from nick_derobertis_site.common.component import HTMLComponent
from .course_pane_model import CoursePaneModel
from ...general.utils import PLACEHOLDER_PDF
from ...general.widgets.button import RaisedPrimaryPDFButton
from ...software_page.software_card.software_card_component import SoftwareCardComponent


class NoColorRaisedPrimaryPDFButton(RaisedPrimaryPDFButton):
    _default_button_css_classes = tuple(RaisedPrimaryPDFButton._default_button_css_classes) + ('no-color',)


class CoursePaneComponent(HTMLComponent):
    model = param.ClassSelector(class_=CoursePaneModel)
    is_reversed: bool = param.Boolean(default=False)
    syllabus_button: NoColorRaisedPrimaryPDFButton = param.ClassSelector(class_=NoColorRaisedPrimaryPDFButton)
    software: List[SoftwareCardComponent] = param.List(class_=SoftwareCardComponent)

    def __init__(self, **params):
        params['software'] = [SoftwareCardComponent(model=mod) for mod in params['model'].software_models]
        if params['model'].pdf_src != PLACEHOLDER_PDF:
            params['syllabus_button'] = NoColorRaisedPrimaryPDFButton(display_text='Syllabus', pdf_src=params['model'].pdf_src,
                                                                      pdf_name=f'{params["model"].title} Syllabus')
        super().__init__(**params)
