import param

from nick_derobertis_site.common.component import HTMLComponent
from .{{ cookiecutter.snake_case_name }}_model import {{ cookiecutter.pascal_case_name }}Model


class {{ cookiecutter.pascal_case_name }}Component(HTMLComponent):
    model = param.ClassSelector(class_={{ cookiecutter.pascal_case_name }}Model)


