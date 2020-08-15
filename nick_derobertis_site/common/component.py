import importlib
import os
import pathlib
from weakref import WeakSet
from typing import Optional, Dict, Any, Sequence, List

import param
from bokeh.models import Row as BkRow
from bokeh.models import Column as BkColumn
from jinja2 import Environment, FileSystemLoader, Template
from panel import Column, Row
from panel.pane import HTML
from panel.viewable import Viewable

from nick_derobertis_site.common.component_template import ComponentTemplateEnvironment
from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.common.updating import UpdatingItem
from nick_derobertis_site.logger import logger


class HTMLComponent(UpdatingItem, Column, Row):
    model = param.ClassSelector(class_=ComponentModel)
    layout_class = param.ObjectSelector(objects=[Column, Row], default=Column)
    template_path: Optional[str] = None
    template_str: Optional[str] = None
    exclude_attrs: Sequence[str] = tuple()
    _column_attrs: Sequence[str] = (
        'align',
        'aspect_ratio',
        'background',
        'children',
        'css_classes',
        'disabled',
        'height',
        'height_policy',
        'js_event_callbacks',
        'js_property_callbacks',
        'margin',
        'max_height',
        'max_width',
        'min_height',
        'min_width',
        'name',
        'rows',
        'sizing_mode',
        'spacing',
        'subscribed_events',
        'tags',
        'visible',
        'width',
        'width_policy'
    )

    def __init__(self, **kwargs):
        # Set up template
        self._validate_template()
        if self.template_path is not None:
            template_dir = os.path.dirname(os.path.realpath(self.template_path))
            template_name = os.path.basename(self.template_path)

            # Create environment with file system loader in the folder containing the template
            self._environment = ComponentTemplateEnvironment(loader=FileSystemLoader(template_dir))

            # Switch template path str passed to environment to just name, as environment was created in that folder
            self._active_template_path = template_name
        else:
            self._environment = ComponentTemplateEnvironment()

        # Set up default styles
        if 'margin' not in kwargs:
            kwargs['margin'] = (0, 0, 0, 0)  # remove default left and top margin
        if 'sizing_mode' not in kwargs:
            kwargs['sizing_mode'] = 'stretch_width'
        UpdatingItem.__init__(self, **kwargs)

        column_kwargs = {k: v for k, v in kwargs.items() if k in self._column_attrs}
        self.layout_class.__init__(self, *self.contents, **column_kwargs)

    @property
    def contents(self) -> List[Viewable]:
        return self.template.render(**self.render_dict)

    def _update_contents(self, *events):
        logger.debug(f'Component {self} update for {events}')
        self[:] = self.contents
        super()._update_contents()

    @property
    def _bokeh_model(self):
        models = {
            Row: BkRow,
            Column: BkColumn
        }
        return models[self.layout_class]

    @property
    def render_dict(self) -> Dict[str, Any]:
        always_exclude_attrs = [
            'template',
            'template_str',
            'template_path',
            'render_dict',
            'contents',
            'exclude_attrs',
            # Parameterized attributes
            'add_periodic_callback',
            'app',
            'applies', 'clone', 'controls', 'debug', 'defaults', 'embed', 'force_new_dynamic_value',
            'get_pane_type', 'get_param_values', 'get_root', 'get_value_generator', 'inspect_value',
            'jscallback', 'jslink', 'link', 'message', 'param', 'param_change', 'params',
            'pprint', 'print_param_defaults', 'print_param_values', 'priority', 'save',
            'script_repr', 'select', 'servable', 'server_doc', 'set_default', 'set_dynamic_time_fn',
            'set_param', 'show', 'state_pop', 'state_push', 'verbose', 'warning'
        ]
        full_exclude = always_exclude_attrs + list(self.exclude_attrs)
        attrs = [item for item in dir(self) if item not in full_exclude and not item.startswith('_')]
        return {attr: getattr(self, attr) for attr in attrs}

    def _init_properties(self):
        props = super()._init_properties()
        column_props = {k: v for k, v in props.items() if k in self._column_attrs}
        return column_props

    def _validate_template(self):
        if self.template_str is not None and self.template_path is not None:
            raise ValueError(f'only specify one of template_str, template_path. got {self.template_str} for '
                             f'template_str, {self.template_path} for template_path')
        if self.template_str is None and self.template_path is None and self._default_template is None:
            raise ValueError(f'must specify one of template_str, template_path, or include a component.html '
                             f'file in the same directory. got {self.template_str} for '
                             f'template_str, {self.template_path} for template_path, and did not '
                             f'find {self._default_template_path}')

    @property
    def template(self) -> Template:
        if self.template_str is not None:
            return self._environment.from_string(self.template_str)
        if self.template_path is not None:
            return self._environment.get_template(self._active_template_path)
        return self._environment.from_string(self._default_template)

    @template.setter
    def template(self, value: str):
        self.template_path = value
        self._validate_template()

    @property
    def _root_path(self) -> pathlib.Path:
        module = importlib.import_module(self.__module__)
        if module.__name__ == '__main__':
            return pathlib.Path('.')
        return pathlib.Path(module.__file__).parent

    @property
    def _default_template_path(self) -> pathlib.Path:
        return self._root_path / 'component.html'

    @property
    def _default_template(self) -> Optional[str]:
        if not self._default_template_path.exists():
            return None
        return self._default_template_path.read_text()


