"""
Copies the passed environment's .env file to the main .env file
"""
import os
import pathlib
import shutil
from os import PathLike
from typing import Union

ENV_PATH = pathlib.Path(__file__).parent / ".env"
BACKUP_ENV_PATH = str(ENV_PATH) + ".bak"


def _named_env_path(env_name: str) -> str:
    return str(ENV_PATH) + f".{env_name}"


def _copy(src: Union[str, PathLike], dst: Union[str, PathLike]):
    print(f'Copying {src} to {dst}')
    shutil.copy(src, dst)


def copy_env(env_name: str):
    new_env_path = _named_env_path(env_name)
    if not os.path.exists(new_env_path):
        raise ValueError(f'could not find environment file {new_env_path}')
    if os.path.exists(ENV_PATH):
        _copy(ENV_PATH, BACKUP_ENV_PATH)
    _copy(new_env_path, ENV_PATH)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "env_name",
        help="The environment name. For example, if you have a file "
             ".env.prod then you would pass prod",
    )

    args = parser.parse_args()

    copy_env(args.env_name)
