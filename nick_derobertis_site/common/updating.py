from typing import Sequence
from weakref import WeakSet

import param

from nick_derobertis_site.logger import logger


class UpdatingItem(param.Parameterized):
    _dependents: WeakSet
    exclude_update_attrs: Sequence[str] = tuple()

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._dependents = WeakSet()
        watch_keys = [key for key, value in self.get_param_values() if key not in self.exclude_update_attrs]
        self.param.watch(self._update_contents, watch_keys)
        for key, event_source in self.get_param_values():
            if isinstance(event_source, UpdatingItem):
                logger.debug(f'Adding dependent {self} to {event_source}')
                event_source._dependents.add(self)

    def _update_contents(self, *events):
        logger.debug(f'Base update {self} with events {events} and dependents {list(self._dependents)}')
        for dependent in self._dependents:
            try:
                dependent._update_contents()
            except AttributeError:
                pass
