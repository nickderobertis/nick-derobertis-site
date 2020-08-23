import param
from derobertis_cv.pltemplates.software.project import SoftwareProject

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.general.utils import PLACEHOLDER_IMAGE


class SoftwareCardModel(ComponentModel):
    image_src: str = param.String(default=PLACEHOLDER_IMAGE)
    body_text: str = param.String(default='Placeholder body')
    header_text: str = param.String(default='Title')
    small_header_text: str = param.String(default='Small Title')
    github_url: str = param.String(default='#')
    docs_url: str = param.String(default='#')
    accent_text: str = param.String(default='Accent')

    @classmethod
    def from_software_project(cls, project: SoftwareProject):
        return cls(
            body_text=project.description,
            header_text=project.display_title,
            small_header_text=project.title,
            github_url=project.url or '',
            image_src=project.logo_url or project.logo_base64 or '',
            docs_url=project.docs_url or '',
            accent_text=f'{project.commits} Commits, {project.loc:,.0f} LOC'
        )





