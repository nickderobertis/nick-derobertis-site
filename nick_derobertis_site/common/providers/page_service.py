from typing import Sequence

from nick_derobertis_site.common.services.page import PageService


class HasPageService:
    _page_service: PageService
    __exclude_attrs = ('_page_service', 'page_service')
    exclude_attrs: Sequence[str]

    def __init__(self, **params):
        if hasattr(self, 'exclude_attrs'):
            self.exclude_attrs = tuple(self.exclude_attrs) + self.__exclude_attrs
        super().__init__(**params)

    @property
    def page_service(self) -> PageService:
        if not hasattr(self, '_page_service') or self._page_service is None:
            from nick_derobertis_site.service_config import SERVICES
            self._page_service = SERVICES.page_service
        return self._page_service