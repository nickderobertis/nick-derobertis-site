import boto3
from boto3_type_annotations.route53 import Client as Route53Client

from cdk_files.aws_ext.route53 import get_hosted_zone_id_by_name
from .config import DeploymentConfig

ROUTE53_CLIENT: Route53Client = boto3.client("route53")


def update_ns_record(
    cfg: DeploymentConfig = DeploymentConfig(), client: Route53Client = ROUTE53_CLIENT
):
    zone_id = get_hosted_zone_id_by_name(cfg.url)
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
