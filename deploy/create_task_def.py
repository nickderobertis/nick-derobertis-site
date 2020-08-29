import os
import pathlib

from jinja2 import Template

try:
    from .cdk_files.config import AWSSettings, DeploymentNames  # for running from root repo on CI
except ImportError as e:
    if "attempted relative import with no known parent package" in str(e):
        # for running with deploy ./run-docker.sh to see actual output locally
        from cdk_files.config import AWSSettings, DeploymentNames
    else:
        raise e

TEMPLATE_PATH = pathlib.Path(__file__).parent / "task-def.json.j2"


def _load_template(path: str = str(TEMPLATE_PATH)) -> str:
    with open(path, "r") as f:
        contents = f.read()
    return contents


def _fill_values_in_template(template_str: str, aws_model: AWSSettings, names_model: DeploymentNames) -> str:
    tmpl = Template(template_str)
    return tmpl.render(aws=aws_model.dict(), names=names_model.dict())


def create_task_def_json(
    out_folder: str = ".",
    template_path: str = str(TEMPLATE_PATH),
    aws_model: AWSSettings = AWSSettings(),
    names_model: DeploymentNames = DeploymentNames(),
):
    template = _load_template(template_path)
    templated = _fill_values_in_template(template, aws_model=aws_model, names_model=names_model)
    out_path = os.path.join(out_folder, "task-def.json")
    with open(out_path, "w") as f:
        f.write(templated)

    print("Created task-def.json")
    print(templated)


if __name__ == "__main__":
    create_task_def_json()
