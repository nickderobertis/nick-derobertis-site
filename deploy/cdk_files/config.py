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


class DeploymentNames(BaseSettings):
    app: str = Field(env='DEPLOY_APP_NAME')
    ecr_repo: str = 'repository'
    vpc: str = 'vpc'
    ecs_cluster: str = 'cluster'
    ecs_execution_role: str = 'execution-role'
    ecs_task_definition: str = 'task-definition'
    ecs_service: str = 'service'
    load_balancer: str = 'load-balancer'
    autoscaling_cpu_policy: str = 'auto-scaling-policy-cpu'
    autoscaling_memory_policy: str = 'auto-scaling-policy-memory'
    autoscaling_requests_policy: str = 'auto-scaling-policy-requests'

    @root_validator
    def add_app_name(cls, values: dict) -> dict:
        out_dict = {}
        for key, value in values.items():
            if key == 'app':
                out_dict[key] = value
                continue
            out_dict[key] = f"{values['app']}-{value}"
        return out_dict

    class Config:
        env_prefix = 'deploy_name_suffix_'


class DeploymentConfig(BaseSettings):
    is_public: bool = True
    autoscale: AutoscaleSettings = AutoscaleSettings()
    names: DeploymentNames = DeploymentNames()

    class Config:
        env_prefix = "deploy_"


if __name__ == "__main__":
    print(DeploymentConfig().dict())
