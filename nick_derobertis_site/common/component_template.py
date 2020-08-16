import re
from typing import Dict, Any, List
from weakref import WeakValueDictionary

import panel as pn
from jinja2 import Template, Environment
from panel.viewable import Viewable

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
        viewables = []
        for part in parts:
            if part.startswith('<panel-object-ref>'):
                obj_id = _id_from_panel_object_ref(part)
                panel_obj = self._embedded_items[obj_id]
            else:
                panel_obj = pn.pane.HTML(part)
            viewables.append(panel_obj)
        return viewables

    @property
    def _render_dict(self) -> Dict[str, Any]:
        return dict(
            embed=self._embed
        )

    def _embed(self, item) -> str:
        self._add_embedded_item(item)
        return _object_ref_xml(item)

    def _add_embedded_item(self, item: Any):
        self._embedded_items[id(item)] = item


class ComponentTemplateEnvironment(Environment):
    template_class = ComponentTemplate