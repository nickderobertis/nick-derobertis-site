import param

from awesome_panel_extensions.component import HTMLComponent as AwesomeHTMLComponent
from nick_derobertis_site.common.services.common import Services


class HTMLComponent(AwesomeHTMLComponent):
    services: Services = param.ClassSelector(class_=Services)