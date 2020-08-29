import os
import pathlib
from dataclasses import dataclass, fields, Field
from typing import Dict

from jinja2 import Template

TEMPLATE_PATH = pathlib.Path(__file__).parent / "task-def.json.j2"

APP_NAME = os.environ.get("DEPLOY_APP_NAME", "my-app")
if not APP_NAME:
    APP_NAME = "my-app"
AWS_ACCOUNT_ID = os.environ["AWS_ROOT_ACCOUNT_ID"]
AWS_REGION = os.environ["AWS_DEFAULT_REGION"]


@dataclass
class TaskDefinitionModel:
    app_name: str = APP_NAME
    aws_account_id: str = AWS_ACCOUNT_ID
    aws_region: str = AWS_REGION

    def to_dict(self) -> Dict[str, str]:
        field: Field
        template_names = [field.name for field in fields(self)]
        return {name: getattr(self, name) for name in template_names}


def _load_template(path: str = str(TEMPLATE_PATH)) -> str:
    with open(path, "r") as f:
        contents = f.read()
    return contents


def _fill_values_in_template(
    template_str: str, model: TaskDefinitionModel
) -> str:
    tmpl = Template(template_str)
    return tmpl.render(model.to_dict())


def create_task_def_json(
    out_folder: str = ".",
    template_path: str = str(TEMPLATE_PATH),
    model: TaskDefinitionModel = TaskDefinitionModel()
):
    template = _load_template(template_path)
    templated = _fill_values_in_template(
        template, model=model
    )
    out_path = os.path.join(out_folder, 'task-def.json')
    with open(out_path, "w") as f:
        f.write(templated)

    print('Created task-def.json')
    print(templated)


if __name__ == "__main__":
    create_task_def_json()
