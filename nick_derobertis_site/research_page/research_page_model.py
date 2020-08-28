from typing import List, Any, Dict, Optional, Union

import param

from nick_derobertis_site.common.page_model import PageModel
from nick_derobertis_site.research_page.research_banner.research_banner_component import ResearchBannerComponent
from nick_derobertis_site.research_page.research_banner.research_banner_model import ResearchBannerModel
from nick_derobertis_site.research_page.research_project_pane.research_project_pane_component import \
    ResearchProjectPaneComponent
from nick_derobertis_site.research_page.research_project_pane.research_project_pane_model import \
    ResearchProjectPaneModel


class ResearchPageModel(PageModel):
    banner_model: ResearchBannerModel = param.ClassSelector(class_=ResearchBannerModel)
    banner: ResearchBannerComponent = param.ClassSelector(class_=ResearchBannerComponent)
    pane_models: List[ResearchProjectPaneModel] = param.List(class_=ResearchProjectPaneModel)
    panes: List[ResearchProjectPaneComponent] = param.List(class_=ResearchProjectPaneComponent)
    

    def __init__(self, **params):
        params['banner'] = ResearchBannerComponent(model=params['banner_model'])
        params = self._set_panes(params)
        super().__init__(**params)

    @param.depends('pane_models', watch=True)
    def _set_panes(self, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        if params is None:
            pane_models = self.pane_models
        else:
            pane_models = params['pane_models']

        all_panes = []
        for i, mod in enumerate(pane_models):
            kwargs: Dict[str, Union[ResearchProjectPaneModel, bool]] = dict(model=mod)
            if i % 2 != 0:
                kwargs.update(dict(is_reversed=True))
            all_panes.append(ResearchProjectPaneComponent(**kwargs))

        if params is None:
            self.panes = all_panes
        else:
            params['panes'] = all_panes

        return params