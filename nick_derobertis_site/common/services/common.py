"""Collection of services which are used globally"""
import param

from nick_derobertis_site.common.services.page import PageService
from nick_derobertis_site.page_config import get_pages


class Services(param.Parameterized):
    """The Services is a placeholder for the different services required by an Application"""

    page_service = param.ClassSelector(class_=PageService)

    def __init__(self, **params):
        if "page_service" not in params:
            routes = get_pages(self)
            home_page = routes["home"]
            loading_page = routes.pop(
                "loading"
            )  # switch to key lookup to work on loading page without it going away
            params["page_service"] = PageService(
                routes=routes,
                page=home_page,
                default_page=home_page,
                loading_page=loading_page,
            )

        super().__init__(**params)


def get_default_services() -> Services:
    services = Services()
    return services
