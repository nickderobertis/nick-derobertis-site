import param

from nick_derobertis_site.general.models.pdf import PDFModel
from nick_derobertis_site.general.utils import PLACEHOLDER_PDF


class HasPDFModel:
    pdf: PDFModel = param.ClassSelector(class_=PDFModel)
    pdf_src: str = param.String(default=PLACEHOLDER_PDF)

    def __init__(self, **params):
        if 'pdf_src' not in params and 'pdf' in params:
            params['pdf_src'] = params['pdf'].src
        super().__init__(**params)

