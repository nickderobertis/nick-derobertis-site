import param

from nick_derobertis_site.common.component import HTMLComponent
from .research_banner_model import ResearchBannerModel
from nick_derobertis_site.general.config import CV_PDF_MODEL
from nick_derobertis_site.general.widgets.button import PrimaryOutlinePDFButton


class ResearchBannerComponent(HTMLComponent):
    model = param.ClassSelector(class_=ResearchBannerModel)
    cv_button: PrimaryOutlinePDFButton = PrimaryOutlinePDFButton(display_text='View CV', pdf_src=CV_PDF_MODEL.src)


