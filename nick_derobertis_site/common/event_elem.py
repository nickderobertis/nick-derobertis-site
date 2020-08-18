from functools import partial

import param
from panel.links import Callback
from panel.widgets import Widget, Button

from nick_derobertis_site.common.bk.event_elem import EventElement as _BkEventElement


class EventElement(Widget):
    """
    Element that can trigger arbitrary events
    """
    _widget_type = _BkEventElement

    watch_events = param.List(class_=str, doc="""
    A list of events to watch
    """)

    text = param.String()

    clicks = param.Integer(default=0)

    _rename = {'clicks': None}

    def _get_model(self, doc, root=None, parent=None, comm=None):
        model = super()._get_model(doc, root, parent, comm)
        ref = (root or model).ref['id']
        model.on_click(partial(self._server_click, doc, ref))
        return model

    def _server_click(self, doc, ref, event):
        self._events.update({"clicks": 1})
        if not self._processing:
            self._processing = True
            if doc.session_context:
                doc.add_timeout_callback(partial(self._change_event, doc), self._debounce)
            else:
                self._change_event(doc)

    def _process_property_change(self, msg):
        msg = super()._process_property_change(msg)
        if 'clicks' in msg:
            msg['clicks'] = self.clicks + 1
        return msg

    def on_click(self, callback):
        self.param.watch(callback, 'clicks')

    def js_on_click(self, args={}, code=""):
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
        return Callback(self, code={'event:button_click': code}, args=args)

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
            if k == 'clicks':
                k = 'event:button_click'
            callbacks[k] = self._rename.get(v, v)
        return Callback(self, code=callbacks, args=args)
