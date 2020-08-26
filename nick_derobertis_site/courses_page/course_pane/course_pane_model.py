from typing import List, Optional, Dict

import param

from derobertis_cv.models.course import CourseModel

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.common.providers.pdf import HasPDFModel
from nick_derobertis_site.software_page.software_card.software_card_component import SoftwareCardComponent
from nick_derobertis_site.software_page.software_card.software_card_model import SoftwareCardModel


class CoursePaneModel(HasPDFModel, ComponentModel):
    title: str = param.String(default='My Course')
    description: str = param.String(default='Placeholder description')
    periods_taught: List[str] = param.List(class_=str)
    evaluation_score: float = param.Number()
    evaluation_max_score: int = param.Integer()
    university_name: str = param.String()
    university_logo_src: str = param.String()
    course_id: str = param.String()
    topics: Dict[str, List[str]] = param.Dict()
    software_models: List[SoftwareCardModel] = param.List(class_=SoftwareCardModel)
    software: List[SoftwareCardComponent] = param.List(class_=SoftwareCardComponent)

    def __init__(self, **params):
        params['software'] = [SoftwareCardComponent(model=mod) for mod in params.get('software_models', [])]
        super().__init__(**params)

    @classmethod
    def from_course_model(cls, model: CourseModel) -> 'CoursePaneModel':
        params = dict(
            title=model.title,
            description=model.description,
            periods_taught=model.periods_taught,
            evaluation_score=model.evaluation_score or 0,
            evaluation_max_score=model.evaluation_max_score,
            course_id=model.course_id,
        )

        if model.university is not None:
            params.update(
                university_name=model.university.title,
                university_logo_src=model.university.logo_base64
            )

        if model.topics is not None:
            topics = {}
            for topic in model.topics:
                child_topics = [child_topic.title for child_topic in topic.children]
                topics[topic.title] = child_topics
            params.update(topics=topics)

        if model.software_projects is not None:
            software_card_models = [SoftwareCardModel.from_software_project(mod) for mod in model.software_projects]
            params.update(software_models=software_card_models)

        return cls(**params)
