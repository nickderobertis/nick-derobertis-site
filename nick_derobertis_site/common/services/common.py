"""Collection of services which are used globally"""
import param

from nick_derobertis_site.common.services.page import PageService


class Services(param.Parameterized):
    """The Services is a placeholder for the different services required by an Application"""

    page_service = param.ClassSelector(class_=PageService, allow_None=False)

    def __init__(self, **params):
        if "page_service" not in params:
            params["page_service"] = PageService()

        super().__init__(**params)


def get_default_services() -> Services:
    from nick_derobertis_site import page_config as pc

    page_service = PageService(
        routes=pc.ROUTES, page=pc.LANDING_PAGE, default_page=pc.LANDING_PAGE,
        loading_page=pc.LOADING_PAGE,
    )
    services = Services(page_service=page_service)
    return services
