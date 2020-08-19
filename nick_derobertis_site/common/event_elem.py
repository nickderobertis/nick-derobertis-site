from functools import partial
from typing import Callable

import param
from panel.links import Callback
from panel.viewable import Reactive
from panel.widgets import Widget
from bokeh import events

from nick_derobertis_site.common.bk.event_elem import EventElement as _BkEventElement, GeneralEvent
from nick_derobertis_site.common.updating import UpdatingItem


class EventCollection(Reactive, UpdatingItem):
    pass


class EventElement(Widget):
    """
    Element that can trigger arbitrary events
    """
    _widget_type = _BkEventElement

    watch_events = param.List(class_=str, doc="""
    A list of events to watch
    """)

    text = param.String()

    events = param.ClassSelector(class_=EventCollection)

    _rename = {'events': None}

    def __init__(self, **params):
        SelectedEventCollection = type(
            'SelectedEventCollection',
            (EventCollection,),
            {event_name: param.Integer(default=0) for event_name in params['watch_events']}
        )
        params['events'] = SelectedEventCollection()
        for event_name in params['watch_events']:
            if (
                event_name in events._CONCRETE_EVENT_CLASSES and
                events._CONCRETE_EVENT_CLASSES[event_name] != GeneralEvent
            ):
                raise ValueError(
                    f'passed event name {event_name} which conflicts with '
                    f'existing event {events._CONCRETE_EVENT_CLASSES[event_name]}')
            klass_name = f'GeneralEvent{event_name.title()}'
            klass = type(klass_name, (GeneralEvent,), {'event_name': event_name})
            events._CONCRETE_EVENT_CLASSES[event_name] = klass

        super().__init__(**params)

    def _update_model(self, events, msg, root, model, doc, comm):
        breakpoint()
        super()._update_model(events, msg, root, model, doc, comm)

    def _get_model(self, doc, root=None, parent=None, comm=None):
        model = super()._get_model(doc, root, parent, comm)
        ref = (root or model).ref['id']
        for event_type in self.watch_events:
            model.on(event_type, partial(self._server_on, doc, ref, event_type))
        return model

    def _server_on(self, doc, ref, event_type: str, event):
        self._events.update({event_type: 1})
        if not self._processing:
            self._processing = True
            if doc.session_context:
                doc.add_timeout_callback(partial(self._change_event, doc), self._debounce)
            else:
                self._change_event(doc)

    def _process_property_change(self, msg):
        msg = super()._process_property_change(msg)
        for key in msg:
            if key in self.watch_events:
                msg[key] = getattr(self.events, key) + 1
        return msg

    def _process_events(self, events):
        self.events.param.set_param(**self._process_property_change(events))

    def on(self, event_type: str, callback: Callable):
        self.events.param.watch(callback, event_type)

    def js_on(self, event_type: str, args={}, code=""):
        """
        Allows defining a JS callback to be triggered when the button
        is clicked.

        Arguments
        ----------
        args: dict
          A mapping of objects to make available to the JS callback
        code: str
          The Javascript code to execute when the button is clicked.

        Returns
        -------
        callback: Callback
          The Callback which can be used to disable the callback.
        """
        return Callback(self, code={'event:' + event_type: code}, args=args)

    def jscallback(self, args={}, **callbacks):
        """
        Allows defining a JS callback to be triggered when a property
        changes on the source object. The keyword arguments define the
        properties that trigger a callback and the JS code that gets
        executed.

        Arguments
        ----------
        args: dict
          A mapping of objects to make available to the JS callback
        **callbacks: dict
          A mapping between properties on the source model and the code
          to execute when that property changes

        Returns
        -------
        callback: Callback
          The Callback which can be used to disable the callback.
        """
        for k, v in list(callbacks.items()):
            k = 'event:' + k
            callbacks[k] = self._rename.get(v, v)
        return Callback(self, code=callbacks, args=args)
