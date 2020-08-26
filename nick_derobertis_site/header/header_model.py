import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.common.providers.pdf import HasPDFModel
from nick_derobertis_site.general.models.image import ImageModel
from nick_derobertis_site.general.utils import PLACEHOLDER_IMAGE


class HeaderModel(HasPDFModel, ComponentModel):
    logo_src = param.String(default=PLACEHOLDER_IMAGE)
    logo = param.ClassSelector(class_=ImageModel)

    def __init__(self, **params):
        if 'logo_src' not in params and 'logo' in params:
            params['logo_src'] = params['logo'].src
        super().__init__(**params)
