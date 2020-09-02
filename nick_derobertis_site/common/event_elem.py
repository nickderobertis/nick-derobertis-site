import param

from awesome_panel_extensions.event_elem import GeneralEvent, EventElement as AwesomeEventElement, EventCollection
from nick_derobertis_site.common.services.common import Services


class EventElement(AwesomeEventElement):
    services: Services = param.ClassSelector(class_=Services)
