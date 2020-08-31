from typing import List

import boto3
from boto3_type_annotations.ec2 import Client as EC2Client

from cdk_files.config import DeploymentConfig

EC2_CLIENT: EC2Client = boto3.client("ec2")


def _get_security_group_details(client: EC2Client = EC2_CLIENT) -> dict:
    return client.describe_security_groups()


def get_security_group_id_matching_description(
    description: str, client: EC2Client = EC2_CLIENT
) -> str:
    details = client.describe_security_groups(
        Filters=[{"Name": "description", "Values": [description]}]
    )
    sg_details = details["SecurityGroups"]
    if len(sg_details) == 0:
        raise ValueError(
            f"Could not find security group matching description: {description}"
        )
    return sg_details[0]["GroupId"]


def get_service_security_group_id(
    cfg: DeploymentConfig = DeploymentConfig(), client: EC2Client = EC2_CLIENT
) -> str:
    sg_description = f"{cfg.names.app}/{cfg.names.ecs_service}/SecurityGroup"
    return get_security_group_id_matching_description(sg_description, client=client)


def _add_rule_to_sg_ingress(
    sg_id: str,
    port: int,
    cidr: str = "0.0.0.0/0",
    protocol: str = "tcp",
    client: EC2Client = EC2_CLIENT,
):
    print(f"Adding inbound rule for {sg_id} on port {port} with protocol {protocol}")
    client.authorize_security_group_ingress(
        GroupId=sg_id,
        IpPermissions=[
            {
                "IpProtocol": protocol,
                "FromPort": port,
                "ToPort": port,
                "IpRanges": [{"CidrIp": cidr}],
            }
        ],
    )


def add_rule_to_security_group(
    sg_id: str,
    port: int,
    cidr: str = "0.0.0.0/0",
    protocol: str = "tcp",
    inbound: bool = True,
    client: EC2Client = EC2_CLIENT,
):
    if not inbound:
        raise NotImplementedError(
            "Need to add function for outbound security group rules"
        )

    _add_rule_to_sg_ingress(sg_id, port, cidr=cidr, protocol=protocol, client=client)
