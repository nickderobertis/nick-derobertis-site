import pathlib

from cookiecutter.main import cookiecutter

BASE_TEMPLATE_PATH = pathlib.Path(__file__).parent / 'templates'
COMPONENT_TEMPLATE_PATH = BASE_TEMPLATE_PATH / 'component'


def create_component(name: str):
    """

    :param name: PascalCase version of the component name without the word component
    :return:
    """
    snake_case_name = ''.join(['_' + i.lower() if i.isupper() else i for i in name]).lstrip('_')
    context = dict(
        pascal_case_name=name,
        snake_case_name=snake_case_name
    )
    cookiecutter(str(COMPONENT_TEMPLATE_PATH), no_input=True, extra_context=context)