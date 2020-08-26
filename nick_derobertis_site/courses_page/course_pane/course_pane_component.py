import param

from nick_derobertis_site.common.component import HTMLComponent
from .course_pane_model import CoursePaneModel
from ...general.utils import PLACEHOLDER_PDF
from ...general.widgets.button import RaisedPrimaryPDFButton


class NoColorRaisedPrimaryPDFButton(RaisedPrimaryPDFButton):
    _default_button_css_classes = tuple(RaisedPrimaryPDFButton._default_button_css_classes) + ('no-color',)


class CoursePaneComponent(HTMLComponent):
    model = param.ClassSelector(class_=CoursePaneModel)
    is_reversed: bool = param.Boolean(default=False)
    syllabus_button: NoColorRaisedPrimaryPDFButton = param.ClassSelector(class_=NoColorRaisedPrimaryPDFButton)

    def __init__(self, **params):
        if params['model'].pdf_src != PLACEHOLDER_PDF:
            params['syllabus_button'] = NoColorRaisedPrimaryPDFButton(display_text='Syllabus', pdf_src=params['model'].pdf_src)
        super().__init__(**params)
