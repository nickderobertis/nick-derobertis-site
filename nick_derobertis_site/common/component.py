import importlib
import os
import pathlib
from typing import Optional, Dict, Any, Sequence

from jinja2 import Environment, FileSystemLoader, Template
from panel.pane import HTML


class HTMLComponent(HTML):
    template_path: Optional[str] = None
    template_str: Optional[str] = None
    exclude_attrs: Sequence[str] = tuple()

    def __init__(self, **kwargs):
        self._validate_template()
        if self.template_path is not None:
            template_dir = os.path.dirname(os.path.realpath(self.template_path))
            template_name = os.path.basename(self.template_path)

            # Create environment with file system loader in the folder containing the template
            self._environment = Environment(loader=FileSystemLoader(template_dir))

            # Switch template path str passed to environment to just name, as environment was created in that folder
            self._active_template_path = template_name
        else:
            self._environment = Environment()
        super().__init__(self.contents, **kwargs)

    @property
    def contents(self) -> str:
        return self.template.render(**self.render_dict)

    @property
    def render_dict(self) -> Dict[str, Any]:
        always_exclude_attrs = [
            'template',
            'template_str',
            'template_path',
            'render_dict',
            'contents',
            'exclude_attrs',
        ]
        full_exclude = always_exclude_attrs + list(self.exclude_attrs)
        attrs = [item for item in dir(self) if item not in full_exclude and not item.startswith('_')]
        return {attr: getattr(self, attr) for attr in attrs}

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
        return pathlib.Path(module.__file__).parent

    @property
    def _default_template_path(self) -> pathlib.Path:
        return self._root_path / 'component.html'

    @property
    def _default_template(self) -> Optional[str]:
        if not self._default_template_path.exists():
            return None
        return self._default_template_path.read_text()


