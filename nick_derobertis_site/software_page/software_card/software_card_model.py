import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.general.utils import PLACEHOLDER_IMAGE


class SoftwareCardModel(ComponentModel):
    image_src: str = param.String(default=PLACEHOLDER_IMAGE)
    body_text: str = param.String(default='Placeholder body')
    header_text: str = param.String(default='Title')
    github_url: str = param.String(default='#')
    docs_url: str = param.String(default='#')
    accent_text: str = param.String(default='Accent')





