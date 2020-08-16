from html import escape

from panel.pane.markup import DivPaneBase

from nick_derobertis_site.common.bk.raw import Raw as _BkRaw


class Raw(DivPaneBase):
    """
    HTML panes wrap HTML text in a Panel HTML model. The
    provided object can either be a text string, or an object that
    has a `_repr_html_` method that can be called to get the HTML
    text string.  The height and width can optionally be specified, to
    allow room for whatever is being wrapped.
    """

    # Priority is dependent on the data type
    priority = None
    _bokeh_model = _BkRaw

    @classmethod
    def applies(cls, obj):
        return True

    def _get_properties(self):
        properties = super()._get_properties()
        text = '' if self.object is None else self.object
        if hasattr(text, '_repr_html_'):
            text = text._repr_html_()
        return dict(properties, text=text)