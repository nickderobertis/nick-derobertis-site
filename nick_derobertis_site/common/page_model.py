import param

from nick_derobertis_site.common.model import ComponentModel


class PageModel(ComponentModel):
    page_link_text = param.String()
    page_title = param.String()
