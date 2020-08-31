import boto3
from boto3_type_annotations.route53 import Client as Route53Client

from cdk_files.aws_ext.route53 import get_hosted_zone_id_by_name, update_record
from .config import DeploymentConfig

ROUTE53_CLIENT: Route53Client = boto3.client("route53")


def update_ns_record(
    cfg: DeploymentConfig = DeploymentConfig(), client: Route53Client = ROUTE53_CLIENT
):
    update_record(cfg.url, "NS", cfg.name_servers, client=client)


def update_soa_record(
    cfg: DeploymentConfig = DeploymentConfig(), client: Route53Client = ROUTE53_CLIENT
):
    soa_str = f"{cfg.name_servers[0]}. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"
    update_record(cfg.url, "SOA", [soa_str], client=client)


if __name__ == "__main__":
    cfg = DeploymentConfig()
    if cfg.name_servers is not None:
        update_ns_record(cfg=cfg)
        update_soa_record(cfg=cfg)
    else:
        print("No name servers passed in config, will use auto-assigned name servers")
