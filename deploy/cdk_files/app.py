#!/usr/bin/env python3

from aws_cdk import core

from config import DeploymentConfig
from deploy_cdk.deploy_cdk_stack import DeployCdkStack

cfg = DeploymentConfig()
app = core.App()
stack = DeployCdkStack(app, cfg.names.app, cfg=cfg)

app.synth()
