#!/usr/bin/env python3

from aws_cdk import core
from config import DeploymentConfig
from deploy_cdk.deploy_cdk_stack import DeployCdkStack

cfg = DeploymentConfig()
env = core.Environment(account=cfg.aws.root_account_id, region=cfg.aws.default_region)
app = core.App()
stack = DeployCdkStack(app, cfg.names.app, cfg=cfg, env=env)

app.synth()
