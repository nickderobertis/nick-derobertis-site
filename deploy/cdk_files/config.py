from typing import Optional

from pydantic import validator, BaseSettings, Field, root_validator


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
        env_prefix = 'aws_'


class DeploymentNames(BaseSettings):
    app: str = Field(env='DEPLOY_APP_NAME')
    short_app: str = Field(env='DEPLOY_APP_SHORT_NAME')

    ecr_repo: str = 'repository'
    vpc: str = 'vpc'
    ecs_cluster: str = 'cluster'
    ecs_execution_role: str = 'execution-role'
    ecs_task_definition: str = 'task-definition'
    ecs_service: str = 'service'
    load_balancer: str = 'lb'
    load_balancer_listener: str = 'lb-listener'
    load_balancer_listener_target_groups: str = 'lb-listener-tgs'
    autoscaling_cpu_policy: str = 'as-policy-cpu'
    autoscaling_memory_policy: str = 'as-policy-memory'
    autoscaling_requests_policy: str = 'as-policy-requests'
    autoscaling_target_group: str = 'as-target-group'
    route53_zone: str = 'hosted-zone'
    alias_record: str = 'alias-record'
    www_record: str = 'cname-www'

    @root_validator
    def add_app_name(cls, values: dict) -> dict:
        out_dict = {}
        for key, value in values.items():
            if key in ('app', 'short_app'):
                out_dict[key] = value
                continue
            new_name = f"{values['short_app']}-{value}"
            if len(new_name) > 32:
                raise ValueError(f'AWS name must be 32 characters or less. '
                                 f'Got {new_name} of length {len(new_name)} for {key}')
            out_dict[key] = new_name
        return out_dict

    class Config:
        env_prefix = 'deploy_name_suffix_'


class HealthCheckSettings(BaseSettings):
    enable: bool = True
    path: str = '/'
    interval_minutes: int = 1

    class Config:
        env_prefix = 'deploy_health_check_'


class DeploymentConfig(BaseSettings):
    url: str
    is_public: bool = True
    use_health_check: bool = True
    include_www: bool = True
    autoscale: AutoscaleSettings = AutoscaleSettings()
    names: DeploymentNames = DeploymentNames()
    aws: AWSSettings = AWSSettings()
    health_check: HealthCheckSettings = HealthCheckSettings()

    class Config:
        env_prefix = "deploy_"


if __name__ == "__main__":
    print(DeploymentConfig().dict())
