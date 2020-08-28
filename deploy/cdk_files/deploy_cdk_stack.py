"""AWS CDK module to create ECS infrastructure"""
import os

from aws_cdk import (core, aws_ecs as ecs, aws_ec2 as ec2, aws_iam as iam, aws_ecr as ecr)

APP_NAME = os.environ.get('DEPLOY_APP_NAME', 'my-app')
if not APP_NAME:
    APP_NAME = 'my-app'

REGISTRY_PATH = "amazon/amazon-ecs-sample"


class DeployCdkStack(core.Stack):

    def __init__(self, scope: core.Construct, id: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        # Create the ECR Repository
        ecr_repository = ecr.Repository(self,
                                        f"{APP_NAME}-repository",
                                        repository_name=f"{APP_NAME}-repository",
                                        removal_policy=core.RemovalPolicy.DESTROY)

        # Create the ECS Cluster (and VPC)
        vpc = ec2.Vpc(self,
                      f"{APP_NAME}-vpc",
                      max_azs=3)
        cluster = ecs.Cluster(self,
                              f"{APP_NAME}-cluster",
                              cluster_name=f"{APP_NAME}-cluster",
                              vpc=vpc)

        # Create the ECS Task Definition with placeholder container (and named Task Execution IAM Role)
        execution_role = iam.Role(self,
                                  f"{APP_NAME}-execution-role",
                                  assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
                                  role_name=f"{APP_NAME}-execution-role")
        execution_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            resources=["*"],
            actions=[
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ]
        ))
        task_definition = ecs.FargateTaskDefinition(self,
                                                    f"{APP_NAME}-task-definition",
                                                    execution_role=execution_role,
                                                    family=f"{APP_NAME}-task-definition")
        container = task_definition.add_container(
            APP_NAME,
            image=ecs.ContainerImage.from_registry(REGISTRY_PATH)
        )

        # Create the ECS Service
        service = ecs.FargateService(self,
                                     f"{APP_NAME}-service",
                                     cluster=cluster,
                                     task_definition=task_definition,
                                     service_name=f"{APP_NAME}-service")