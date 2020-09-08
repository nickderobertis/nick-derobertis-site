from typing import List

import param

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.general.config import CV_PDF_MODEL
from nick_derobertis_site.general.widgets.button import (
    PrimaryRaisedButton,
    RaisedPrimaryPDFButton,
)
from .contact_pane_model import ContactPaneModel


class ContactPaneComponent(HTMLComponent):
    model = param.ClassSelector(class_=ContactPaneModel)
    buttons: List[PrimaryRaisedButton] = param.List(class_=PrimaryRaisedButton)
    cv_button: RaisedPrimaryPDFButton = RaisedPrimaryPDFButton(
        display_text="View CV", pdf_src=CV_PDF_MODEL.src, pdf_name="Nick DeRobertis CV"
    )

    def __init__(self, **params):
        params["buttons"] = [
            PrimaryRaisedButton(model=mod, services=params['services']) for mod in params["model"].button_models
        ]
        super().__init__(**params)
