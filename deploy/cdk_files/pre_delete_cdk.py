"""
Additional cleanup of resources required before calling cdk destroy

Currently removes any images in ECR
"""
from typing import Dict, List, Optional, Sequence

import boto3
import botocore
from boto3_type_annotations.ecr import Client as ECRClient

from .config import DeploymentConfig

ECR_CLIENT: ECRClient = boto3.client("ecr")


def _get_ecr_images_dict(repository_name: str, client: ECRClient = ECR_CLIENT) -> dict:
    return client.list_images(repositoryName=repository_name, maxResults=1000)


def _get_ecr_image_id_dicts(repository_name: str) -> List[str]:
    data = _get_ecr_images_dict(repository_name)
    return data["imageIds"]


def delete_images(
    cfg: DeploymentConfig,
    images: Optional[Sequence[Dict[str, str]]] = None,
    client: ECRClient = ECR_CLIENT,
):
    if images is None:
        images = _get_ecr_image_id_dicts(cfg.names.ecr_repo)
    if not images:
        print("Did not find any ECR images so will not delete them")
        return
    print(f"Found {len(images)} images, will delete them")
    client.batch_delete_image(repositoryName=cfg.names.ecr_repo, imageIds=images)


def pre_delete_cdk_operations(cfg: DeploymentConfig = DeploymentConfig()):
    try:
        delete_images(cfg)
    except botocore.exceptions.ClientError as e:
        if e.response["Error"]["Code"] == "RepositoryNotFoundException":
            print(
                f"No repository with name {cfg.names.ecr_repo} so will not delete images"
            )
        else:
            raise e


if __name__ == "__main__":
    pre_delete_cdk_operations()
