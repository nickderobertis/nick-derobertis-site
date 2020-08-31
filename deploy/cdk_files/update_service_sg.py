from boto3_type_annotations.ec2 import Client as EC2Client

from cdk_files.aws_ext.ec2 import (
    get_service_security_group_id,
    EC2_CLIENT,
    add_rule_to_security_group,
)
from cdk_files.config import DeploymentConfig


def add_ssh_rule_to_ecs_service_security_group(
    cfg: DeploymentConfig = DeploymentConfig(), client: EC2Client = EC2_CLIENT
):
    sg_id = get_service_security_group_id(cfg=cfg, client=client)
    add_rule_to_security_group(sg_id, 22, client=client)


if __name__ == "__main__":
    add_ssh_rule_to_ecs_service_security_group()
