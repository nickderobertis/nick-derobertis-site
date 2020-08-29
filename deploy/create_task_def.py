import os
import pathlib

from jinja2 import Template

try:
    from .cdk_files.config import DeploymentConfig
except ImportError:
    from cdk_files.config import DeploymentConfig

TEMPLATE_PATH = pathlib.Path(__file__).parent / "task-def.json.j2"


def _load_template(path: str = str(TEMPLATE_PATH)) -> str:
    with open(path, "r") as f:
        contents = f.read()
    return contents


def _fill_values_in_template(template_str: str, model: DeploymentConfig) -> str:
    tmpl = Template(template_str)
    return tmpl.render(model.dict())


def create_task_def_json(
    out_folder: str = ".",
    template_path: str = str(TEMPLATE_PATH),
    model: DeploymentConfig = DeploymentConfig(),
):
    template = _load_template(template_path)
    templated = _fill_values_in_template(template, model=model)
    out_path = os.path.join(out_folder, "task-def.json")
    with open(out_path, "w") as f:
        f.write(templated)

    print("Created task-def.json")
    print(templated)


if __name__ == "__main__":
    create_task_def_json()
