import os
import pathlib

from jinja2 import Template

try:
    from .cdk_files.config import DeploymentConfig  # for running from root repo on CI
except ImportError as e:
    if "attempted relative import with no known parent package" in str(e):
        # for running with deploy ./run-docker.sh to see actual output locally
        from cdk_files.config import DeploymentConfig
    else:
        raise e

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
