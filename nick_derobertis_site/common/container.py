import param
from panel.layout import ListPanel

from nick_derobertis_site.common.bk.container import Container as BkContainer


class Container(ListPanel):
    """
    Horizontal layout of Viewables.
    """

    _bokeh_model = BkContainer

    child_css_classes = param.List(class_=str, doc="""
    A list of CSS class names to add to the immediate children of the DOM element. 
    
    Note: the class names are
    simply added as-is, no other guarantees are provided.

    It is also permissible to assign from tuples, however these are adapted -- the
    property will always contain a list.
    """)