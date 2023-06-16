#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { loadEnvironmentVariablesFile } from '../common/utils';

const app = new cdk.App();
const mode = process.env.MODE === "prod" ? "prod" : "dev";
const env = loadEnvironmentVariablesFile(mode);
const envSuffix = mode == "dev" ? "-dev" : "";

const stackDeployEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: env.region,
};

const vpcStack = new VpcStack(app, env.vpc.stackId + envSuffix, {
  vpcConstructId: env.vpc.constructId + envSuffix,
  vpcName: env.vpc.name + envSuffix,
  vpcCidr: env.vpc.cidr,
  env: stackDeployEnv,
  sgPublicConstructId: env.vpc.securityGroup.public.constructId,
  sgPublicName: env.vpc.securityGroup.public.name,
  sgPrivateConstructId: env.vpc.securityGroup.private.constructId,
  sgPrivateName: env.vpc.securityGroup.private.name,
  sgBastionConstructId: env.vpc.securityGroup.bastion.constructId,
  sgBastionName: env.vpc.securityGroup.bastion.name,
  sgIsolatedConstructId: env.vpc.securityGroup.isolated.constructId,
  sgIsolatedName: env.vpc.securityGroup.isolated.name,
});

app.synth();

// new DjangoDeployCdkStack(app, 'DjangoDeployCdkStack', {
//   /* If you don't specify 'env', this stack will be environment-agnostic.
//    * Account/Region-dependent features and context lookups will not work,
//    * but a single synthesized template can be deployed anywhere. */

//   /* Uncomment the next line to specialize this stack for the AWS Account
//    * and Region that are implied by the current CLI configuration. */
//   // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

//   /* Uncomment the next line if you know exactly what Account and Region you
//    * want to deploy the stack to. */
//   // env: { account: '123456789012', region: 'us-east-1' },

//   /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
// });