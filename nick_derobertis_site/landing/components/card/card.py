import os
import pathlib
from typing import Optional, Dict, Any

from jinja2 import Environment, FileSystemLoader
from panel.pane import HTML

ROOT_PATH = pathlib.Path(__file__).parent
HTML_PATH = ROOT_PATH / "card.html"


class CardComponent(HTML):
    template_path = HTML_PATH
    exclude_attrs = tuple()

    def __init__(self, heading: str, body_text: str, image_path: str, link: Optional[str] = None,
                 **kwargs):
        self.heading = heading
        self.body_text = body_text
        self.image_path = image_path
        self.link = link

        if self.template_path is not None:
            template_dir = os.path.dirname(os.path.realpath(self.template_path))
            template_name = os.path.basename(self.template_path)

            # Create environment with file system loader in the folder containing the template
            self._environment = Environment(loader=FileSystemLoader(template_dir))

            # Switch template path str passed to environment to just name, as environment was created in that folder
            self._active_template_path = template_name

        super().__init__(self.contents, **kwargs)

    @property
    def contents(self) -> str:
        template = self._environment.get_template(self._active_template_path)
        return template.render(**self.render_dict)

    @property
    def render_dict(self) -> Dict[str, Any]:
        always_exclude_attrs = [
            '_environment',
            'template',
            'template_str',
            'template_path',
            'render_dict',
            'contents',
        ]
        full_exclude = always_exclude_attrs + list(self.exclude_attrs)
        attrs = [item for item in dir(self) if item not in full_exclude and not item.startswith('_')]
        return {attr: getattr(self, attr) for attr in attrs}


