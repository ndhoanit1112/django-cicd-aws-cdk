#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { loadEnvironmentVariablesFile } from '../common/utils';
import { VpcStack } from '../lib/vpc-stack';
import { RdsStack } from '../lib/rds-stack';
import { EcrStack } from '../lib/ecr-stack';
import { ElbStack } from '../lib/elb-stack';
import { EcsStack } from '../lib/ecs-stack';
import { SqsStack } from '../lib/sqs-stack';

const app = new cdk.App();
const mode = process.env.MODE === "prod" ? "prod" : "dev";
const env = loadEnvironmentVariablesFile(mode);
const envSuffix = mode == "dev" ? "-dev" : "";

const stackDeployEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: env.region,
};

const vpcStack = new VpcStack(app, env.vpc.stackId + envSuffix, {
  mode: mode,
  env: stackDeployEnv,
  ...env.vpc
});

const rdsStack = new RdsStack(app, env.rds.stackId + envSuffix, {
  env: stackDeployEnv,
  mode: mode,
  vpc: vpcStack.vpc,
  dbSecurityGroup: vpcStack.isolatedSg,
  bastionSecurityGroup: vpcStack.bastionSg,
  ...env.rds
});

const ecrStack = new EcrStack(app, env.ecr.stackId + envSuffix, {
  env: stackDeployEnv,
  mode: mode,
  ...env.ecr
});

const elbStack = new ElbStack(app, env.elb.stackId + envSuffix, {
  env: stackDeployEnv,
  vpc: vpcStack.vpc,
  securityGroup: vpcStack.publicSg,
  ...env.elb
});

const ecsStack = new EcsStack(app, env.ecs.stackId + envSuffix, {
  env: stackDeployEnv,
  mode: mode,
  vpc: vpcStack.vpc,
  webImageRepository: ecrStack.webappRepository,
  nginxImageRepository: ecrStack.nginxRepository,
  celeryImageRepository: ecrStack.celeryRepository,
  privateSecurityGroup: vpcStack.privateSg,
  elbTargetGroup: elbStack.targetGroup,
  ...env.ecs,
});

const sqsStack = new SqsStack(app, env.sqs.stackId + envSuffix, {
  env: stackDeployEnv,
  ...env.sqs
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