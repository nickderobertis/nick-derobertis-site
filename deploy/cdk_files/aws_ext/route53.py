from typing import List

import boto3
from boto3_type_annotations.route53 import Client as Route53Client

ROUTE53_CLIENT: Route53Client = boto3.client("route53")


def _list_hosted_zones(client: Route53Client = ROUTE53_CLIENT) -> List[dict]:
    response = client.list_hosted_zones()
    return response["HostedZones"]


def get_hosted_zone_id_by_name(
    name: str, client: Route53Client = ROUTE53_CLIENT
) -> str:
    zones = _list_hosted_zones(client)
    for zone in zones:
        if zone["Name"] in (name, name + "."):
            return zone["Id"]
    raise ValueError(f"Could not find hosted zone with name {name}. Got names: {[zone['Name'] for zone in zones]}")