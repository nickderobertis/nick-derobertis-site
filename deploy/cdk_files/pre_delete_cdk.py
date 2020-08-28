"""
Additional cleanup of resources required before calling cdk destroy

Currently removes any images in ECR
"""
import os
from typing import List, Optional, Sequence, Dict

import boto3

APP_NAME = os.environ.get('DEPLOY_APP_NAME', 'my-app')
if not APP_NAME:
    APP_NAME = 'my-app'

REPOSITORY_NAME = f'{APP_NAME}-repository'

ECR_CLIENT = boto3.client('ecr')


def get_ecr_images_dict(repository_name: str = REPOSITORY_NAME, client=ECR_CLIENT) -> dict:
    return client.list_images(
        repositoryName=repository_name,
        maxResults=1000
    )


def get_ecr_image_id_dicts(repository_name: str = REPOSITORY_NAME) -> List[str]:
    data = get_ecr_images_dict(repository_name)
    return data['imageIds']


def delete_images(
    images: Optional[Sequence[Dict[str, str]]] = None,
    repository_name: str = REPOSITORY_NAME,
    client=ECR_CLIENT
):
    if images is None:
        images = get_ecr_image_id_dicts(repository_name)
    if not images:
        print('Did not find any ECR images so will not delete them')
        return
    print(f'Found {len(images)} images, will delete them')
    client.batch_delete_image(
        repositoryName=repository_name,
        imageIds=images
    )


def pre_delete_cdk_operations():
    delete_images()


if __name__ == '__main__':
    pre_delete_cdk_operations()
