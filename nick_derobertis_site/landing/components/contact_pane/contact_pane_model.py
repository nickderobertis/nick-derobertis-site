import param

from nick_derobertis_site.common.model import ComponentModel


class ContactPaneModel(ComponentModel):
    email: str = param.String()