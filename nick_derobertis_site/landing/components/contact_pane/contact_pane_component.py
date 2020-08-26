import param

from nick_derobertis_site.common.component import HTMLComponent
from .contact_pane_model import ContactPaneModel


class ContactPaneComponent(HTMLComponent):
    model = param.ClassSelector(class_=ContactPaneModel)


