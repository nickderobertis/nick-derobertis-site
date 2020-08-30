from typing import List

import boto3
from boto3_type_annotations.route53 import Client as Route53Client

from .config import DeploymentConfig

ROUTE53_CLIENT: Route53Client = boto3.client("route53")


def _list_hosted_zones(client: Route53Client = ROUTE53_CLIENT) -> List[dict]:
    response = client.list_hosted_zones()
    return response["HostedZones"]


def _get_hosted_zone_id_by_name(
    name: str, client: Route53Client = ROUTE53_CLIENT
) -> str:
    zones = _list_hosted_zones(client)
    for zone in zones:
        if zone["Name"] in (name, name + "."):
            return zone["Id"]
    raise ValueError(f"Could not find hosted zone with name {name}. Got names: {[zone['Name'] for zone in zones]}")


def update_ns_record(
    cfg: DeploymentConfig = DeploymentConfig(), client: Route53Client = ROUTE53_CLIENT
):
    zone_id = _get_hosted_zone_id_by_name(cfg.url)
    comment = f"Updated NS records for {cfg.url} to {cfg.name_servers}"

    client.change_resource_record_sets(
        HostedZoneId=zone_id,
        ChangeBatch={
            "Comment": comment,
            "Changes": [
                {
                    "Action": "UPSERT",
                    "ResourceRecordSet": {
                        "Name": cfg.url,
                        "Type": "NS",
                        "TTL": 172800,
                        "ResourceRecords": [{"Value": ns} for ns in cfg.name_servers],
                    },
                }
            ],
        },
    )

    print(comment)


if __name__ == "__main__":
    cfg = DeploymentConfig()
    if cfg.name_servers is not None:
        update_ns_record(cfg=cfg)
    else:
        print('No name servers passed in config, will use auto-assigned name servers')
