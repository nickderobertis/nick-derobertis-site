"""This module implements an ApplicationTemplate based on Material and the mwc-components"""
import pathlib

import panel as pn
import param

ROOT_PATH = pathlib.Path(__file__).parent
HTML_PATH = ROOT_PATH / "home_template.html"
CSS_PATH = ROOT_PATH / "home_template.css"
DEFAULT_NAME = "Material"


class HomeTemplate(pn.Template):
    """
    A Template based on Bootstrap-Material design
    """

    def __init__(self, **params):
        pn.config.sizing_mode = "stretch_width"

        params["template"] = HTML_PATH.read_text()

        super().__init__(**params)

        pn.config.css_files.append(CSS_PATH.resolve())

        self.main = pn.Column(
            name="main", css_classes=["main"], sizing_mode="stretch_both", margin=(25, 50, 50, 50),
        )
        self.add_panel(name="main", panel=self.main)

        self.template_css = pn.pane.HTML(height=0, width=0, sizing_mode="fixed", margin=0)
        self.add_panel(name="template_css", panel=self.template_css)

        self.app_title = pn.Row(pn.pane.Markdown('# Nick DeRobertis'))
        self.add_panel(name='app_title', panel=self.app_title)