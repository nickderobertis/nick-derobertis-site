from panel.layout import ListPanel

from nick_derobertis_site.common.bk.container import Container as BkContainer


class Container(ListPanel):
    """
    Horizontal layout of Viewables.
    """

    _bokeh_model = BkContainer