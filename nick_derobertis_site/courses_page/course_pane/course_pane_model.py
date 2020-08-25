import param

from derobertis_cv.models.course import CourseModel

from nick_derobertis_site.common.model import ComponentModel


class CoursePaneModel(ComponentModel):
    title: str = param.String(default='My Course')
    description: str = param.String(default='Placeholder description')

    @classmethod
    def from_course_model(cls, model: CourseModel) -> 'CoursePaneModel':
        params = dict(
            title=model.title,
            description=model.description
        )

        return cls(**params)
