#!/usr/bin/env python3

from aws_cdk import core

from deploy_cdk.deploy_cdk_stack import DeployCdkStack, APP_NAME


app = core.App()
DeployCdkStack(app, APP_NAME)

app.synth()
