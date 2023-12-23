from typing import Any, Optional, Sequence

from pydantic import BaseSettings, Field, root_validator, validator


class AutoscaleSettings(BaseSettings):
    count_limit: Optional[int] = None
    cpu_pct_limit: Optional[int] = None
    memory_pct_limit: Optional[int] = None
    request_count_limit: Optional[int] = None

    @validator("cpu_pct_limit", "memory_pct_limit")
    def check_pct(cls, value):
        if value is None:
            return
        if value < 1 or value > 100:
            raise ValueError("should be between 1 and 100")
        return value

    class Config:
        env_prefix = "deploy_autoscale_"


class AWSSettings(BaseSettings):
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None
    default_region: Optional[str] = None
    root_account_id: Optional[str] = None

    class Config:
        env_prefix = "aws_"


class DeploymentNames(BaseSettings):
    app: str = Field(env="DEPLOY_APP_NAME")
    short_app: str = Field(env="DEPLOY_APP_SHORT_NAME")

    ecr_repo: str = "repository"
    vpc: str = "vpc"
    ecs_cluster: str = "cluster"
    ecs_execution_role: str = "execution-role"
    ecs_task_definition: str = "task-definition"
    ecs_service: str = "service"
    load_balancer: str = "lb"
    load_balancer_http_listener: str = "lb-http-listener"
    load_balancer_https_listener: str = "lb-https-listener"
    load_balancer_listener_target_groups: str = "lb-listener-tgs"
    autoscaling_cpu_policy: str = "as-policy-cpu"
    autoscaling_memory_policy: str = "as-policy-memory"
    autoscaling_requests_policy: str = "as-policy-requests"
    autoscaling_target_group: str = "as-target-group"
    route53_zone: str = "hosted-zone"
    route53_stack: str = "route53-stack"
    alias_record: str = "alias-record"
    www_record: str = "cname-www-record"
    cert: str = "cert"
    public_key_param: str = "public-key-param"

    @root_validator
    def add_app_name(cls, values: dict) -> dict:
        out_dict = {}
        for key, value in values.items():
            if key in ("app", "short_app"):
                out_dict[key] = value
                continue
            new_name = f"{values['short_app']}-{value}"
            if len(new_name) > 32:
                raise ValueError(
                    f"AWS name must be 32 characters or less. "
                    f"Got {new_name} of length {len(new_name)} for {key}"
                )
            out_dict[key] = new_name
        return out_dict

    class Config:
        env_prefix = "deploy_name_suffix_"


class ParameterNames(BaseSettings):
    ssh_key: str = "SSH_PUBLIC_KEY"

    class Config:
        env_prefix = "deploy_parameter_name_"


class HealthCheckSettings(BaseSettings):
    path: str = "/"
    interval_minutes: int = 1
    timeout_seconds: int = 30
    healthy_http_codes: Sequence[int] = (200,)

    class Config:
        env_prefix = "deploy_health_check_"


class DeploymentConfig(BaseSettings):
    url: Optional[str] = None
    is_public: bool = True
    include_www: bool = True
    include_ssl: bool = True
    container_public_ip: bool = True
    autoscale: AutoscaleSettings = AutoscaleSettings()
    names: DeploymentNames = DeploymentNames()
    aws: AWSSettings = AWSSettings()
    health_check: HealthCheckSettings = HealthCheckSettings()
    params: ParameterNames = ParameterNames()

    class Config:
        env_prefix = "deploy_"


def get_fully_qualified_name_from_config(cfg: DeploymentConfig, name: str) -> Any:
    name_parts = name.split(".")
    value = cfg
    for part in name_parts:
        value = getattr(value, part)
    return value


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "-g", "--get", help="Attribute of config to print, e.g. names.cert"
    )

    args = parser.parse_args()

    cfg = DeploymentConfig()

    if args.get:
        print(get_fully_qualified_name_from_config(cfg, args.get))
    else:
        print(cfg.dict())
