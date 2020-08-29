"""AWS CDK module to create ECS infrastructure"""
import os

from aws_cdk import (
    core,
    aws_ecs as ecs,
    aws_ec2 as ec2,
    aws_iam as iam,
    aws_ecr as ecr,
    aws_elasticloadbalancingv2 as elbv2,
)

from config import DeploymentConfig

DUMMY_REGISTRY_PATH = "amazon/amazon-ecs-sample"


class DeployCdkStack(core.Stack):
    """
    Creates AWS infrastructure using AWS CDK

    See more here: https://docs.aws.amazon.com/cdk/api/latest/python/aws_cdk.aws_ecs.README.html
    """

    def __init__(self, scope: core.Construct, id: str, cfg: DeploymentConfig = DeploymentConfig(), **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        # Create the ECR Repository
        ecr_repository = ecr.Repository(
            self,
            cfg.names.ecr_repo,
            repository_name=cfg.names.ecr_repo,
            removal_policy=core.RemovalPolicy.DESTROY,
        )

        # Create the ECS Cluster (and VPC)
        vpc = ec2.Vpc(self, cfg.names.vpc, max_azs=3)
        cluster = ecs.Cluster(
            self,
            cfg.names.ecs_cluster,
            cluster_name=cfg.names.ecs_cluster,
            vpc=vpc,
        )

        # Create the ECS Task Definition with placeholder container (and named Task Execution IAM Role)
        execution_role = iam.Role(
            self,
            cfg.names.ecs_execution_role,
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            role_name=cfg.names.ecs_execution_role,
        )
        execution_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                resources=["*"],
                actions=[
                    "ecr:GetAuthorizationToken",
                    "ecr:BatchCheckLayerAvailability",
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage",
                    "logs:CreateLogStream",
                    "logs:CreateLogGroup",
                    "logs:PutLogEvents",
                ],
            )
        )
        task_definition = ecs.FargateTaskDefinition(
            self,
            cfg.names.ecs_task_definition,
            execution_role=execution_role,
            family=cfg.names.ecs_task_definition,
        )
        container = task_definition.add_container(
            cfg.names.app,
            image=ecs.ContainerImage.from_registry(DUMMY_REGISTRY_PATH),
            logging=ecs.LogDrivers.aws_logs(stream_prefix=cfg.names.app),
        )

        # Create the ECS Service
        service = ecs.FargateService(
            self,
            cfg.names.ecs_service,
            cluster=cluster,
            task_definition=task_definition,
            service_name=cfg.names.ecs_service,
        )

        # Create a load balancer for the service
        lb = elbv2.ApplicationLoadBalancer(
            self,
            "LB",
            vpc=vpc,
            internet_facing=cfg.is_public,
            load_balancer_name=cfg.names.load_balancer,
        )
        listener = lb.add_listener("Listener", port=80)
        target_group = listener.add_targets("ECS", port=80, targets=[service])

        # Auto scaling options
        scaling = service.auto_scale_task_count(max_capacity=cfg.autoscale.count_limit)
        if cfg.autoscale.cpu_pct_limit:
            scaling.scale_on_cpu_utilization(
                "CpuScaling",
                target_utilization_percent=cfg.autoscale.cpu_pct_limit,
                policy_name=cfg.names.autoscaling_cpu_policy,
            )

        if cfg.autoscale.memory_pct_limit:
            scaling.scale_on_memory_utilization(
                "MemoryScaling",
                target_utilization_percent=cfg.autoscale.memory_pct_limit,
                policy_name=cfg.names.autoscaling_memory_policy,
            )

        if cfg.autoscale.request_count_limit:
            scaling.scale_on_request_count(
                "RequestScaling",
                requests_per_target=cfg.autoscale.request_count_limit,
                target_group=target_group,
                policy_name=cfg.names.autoscaling_requests_policy,
            )
