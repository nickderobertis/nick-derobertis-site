#!/usr/bin/env python3

from aws_cdk import core

from config import DeploymentConfig
from deploy_cdk.deploy_cdk_stack import DeployCdkStack, InitialRoute53Stack


cfg = DeploymentConfig()
env = core.Environment(account=cfg.aws.root_account_id, region=cfg.aws.default_region)
app = core.App()
route53_stack = InitialRoute53Stack(app, cfg.names.route53_stack, cfg=cfg, env=env)
stack = DeployCdkStack(app, cfg.names.app, route53_stack.hosted_zone, cfg=cfg, env=env)

app.synth()
