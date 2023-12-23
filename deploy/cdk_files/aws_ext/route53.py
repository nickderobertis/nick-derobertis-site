from typing import List, Optional, Sequence

import boto3
from boto3_type_annotations.route53 import Client as Route53Client

ROUTE53_CLIENT: Route53Client = boto3.client("route53")

DEFAULT_TTLS = {
    "NS": 172800,
    "CNAME": 300,
    "TXT": 3600,
    "SOA": 900,
}


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
    raise ValueError(
        f"Could not find hosted zone with name {name}. Got names: {[zone['Name'] for zone in zones]}"
    )


def update_record(
    url: str,
    record_type: str,
    values: Sequence[str],
    ttl: Optional[int] = None,
    client: Route53Client = ROUTE53_CLIENT,
):
    zone_id = get_hosted_zone_id_by_name(url)
    if ttl is None:
        ttl = DEFAULT_TTLS.get(record_type)

    comment = f"Updated {record_type} record for {url} to {values}"

    resource_record_set = {
        "Name": url,
        "Type": record_type,
        "ResourceRecords": [{"Value": val} for val in values],
    }
    if ttl is not None:
        resource_record_set.update(TTL=ttl)

    client.change_resource_record_sets(
        HostedZoneId=zone_id,
        ChangeBatch={
            "Comment": comment,
            "Changes": [{"Action": "UPSERT", "ResourceRecordSet": resource_record_set}],
        },
    )

    print(comment)
