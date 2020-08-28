import os
import pathlib
from jinja2 import Template

TEMPLATE_PATH = pathlib.Path(__file__).parent / "task-def.json.j2"

APP_NAME = os.environ.get("DEPLOY_APP_NAME", "my-app")
if not APP_NAME:
    APP_NAME = "my-app"
AWS_ACCOUNT_ID = os.environ["AWS_ROOT_ACCOUNT_ID"]


def _load_template(path: str = str(TEMPLATE_PATH)) -> str:
    with open(path, "r") as f:
        contents = f.read()
    return contents


def _fill_values_in_template(
    template_str: str, app_name: str = APP_NAME, aws_account_id: str = AWS_ACCOUNT_ID
) -> str:
    tmpl = Template(template_str)
    return tmpl.render(app_name=app_name, aws_account_id=aws_account_id)


def create_task_def_json(
    out_folder: str = ".",
    template_path: str = str(TEMPLATE_PATH),
    app_name: str = APP_NAME,
    aws_account_id: str = AWS_ACCOUNT_ID,
):
    template = _load_template(template_path)
    templated = _fill_values_in_template(
        template, app_name=app_name, aws_account_id=aws_account_id
    )
    out_path = os.path.join(out_folder, 'task-def.json')
    with open(out_path, "w") as f:
        f.write(templated)

    print('Created task-def.json')
    print(templated)


if __name__ == "__main__":
    create_task_def_json()
