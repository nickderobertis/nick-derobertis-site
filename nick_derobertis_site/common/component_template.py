import re
from html import escape
from typing import Dict, Any, List, Sequence, Optional
from weakref import WeakValueDictionary

import panel as pn
from bokeh.models import Markup
from jinja2 import Template, Environment
from panel.models import HTML as _BkHTML
from panel.pane.markup import DivPaneBase
from panel.viewable import Viewable

from nick_derobertis_site.common.raw import Raw

FIND_PANEL_OBJECT_REGEX = r'(<panel-object-ref>[\d]+<\/panel-object-ref>)'
PARSE_PANEL_OBJECT_REGEX = r'<panel-object-ref>([\d]+)<\/panel-object-ref>'


def _object_ref_xml(obj: Any) -> str:
    return f'<panel-object-ref>{id(obj)}</panel-object-ref>'


def _id_from_panel_object_ref(ref: str) -> int:
    pattern = re.compile(PARSE_PANEL_OBJECT_REGEX)
    match = pattern.match(ref)
    return int(match.group(1))


class ComponentTemplate(Template):
    _embedded_items: WeakValueDictionary = WeakValueDictionary()

    def render(self, *args, **kwargs) -> List[Viewable]:
        all_kwargs = {**kwargs, **self._render_dict}
        rendered = super().render(*args, **all_kwargs)
        parts = re.split(FIND_PANEL_OBJECT_REGEX, rendered)
        valid_parts = [part for part in parts if not part.isspace()]
        viewables = []
        for part in valid_parts:
            if part.startswith('<panel-object-ref>'):
                obj_id = _id_from_panel_object_ref(part)
                panel_obj = self._embedded_items[obj_id]
            else:
                panel_obj = Raw(part, css_classes=['panel-class-which-marks-elements-to-be-removed'])
            viewables.append(panel_obj)
        return viewables

    @property
    def _render_dict(self) -> Dict[str, Any]:
        return dict(
            embed=self._embed
        )

    def _embed(self, item: Any, css_classes: Optional[Sequence[str]] = None,
               child_css_classes: Optional[Sequence[str]] = None) -> str:
        _add_to_css_classes(item, css_classes)
        _add_to_css_classes(item, child_css_classes, attr='child_css_classes')
        self._add_embedded_item(item)
        return _object_ref_xml(item)

    def _add_embedded_item(self, item: Any):
        self._embedded_items[id(item)] = item


class ComponentTemplateEnvironment(Environment):
    template_class = ComponentTemplate


def _add_to_css_classes(item: Any, css_classes: Optional[Sequence[str]] = None, attr='css_classes'):
    if css_classes is None:
        return
    classes = getattr(item, attr)
    if classes is None:
        classes = []
    classes.extend(css_classes)
    setattr(item, attr, classes)