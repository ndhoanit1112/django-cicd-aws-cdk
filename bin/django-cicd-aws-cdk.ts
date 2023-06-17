#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { loadEnvironmentVariablesFile } from '../common/utils';
import { VpcStack } from '../lib/vpc-stack';
import { RdsStack } from '../lib/rds-stack';
import { EcrStack } from '../lib/ecr-stack';

const app = new cdk.App();
const mode = process.env.MODE === "prod" ? "prod" : "dev";
const env = loadEnvironmentVariablesFile(mode);
const envSuffix = mode == "dev" ? "-dev" : "";

const stackDeployEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: env.region,
};

const vpcStack = new VpcStack(app, env.vpc.stackId + envSuffix, {
  env: stackDeployEnv,
  vpcConstructId: env.vpc.constructId + envSuffix,
  vpcName: env.vpc.name + envSuffix,
  vpcCidr: env.vpc.cidr,
  sgPublicConstructId: env.vpc.securityGroup.public.constructId,
  sgPublicName: env.vpc.securityGroup.public.name,
  sgPrivateConstructId: env.vpc.securityGroup.private.constructId,
  sgPrivateName: env.vpc.securityGroup.private.name,
  sgBastionConstructId: env.vpc.securityGroup.bastion.constructId,
  sgBastionName: env.vpc.securityGroup.bastion.name,
  sgIsolatedConstructId: env.vpc.securityGroup.isolated.constructId,
  sgIsolatedName: env.vpc.securityGroup.isolated.name,
});

const rdsStack = new RdsStack(app, env.rds.stackId + envSuffix, {
  env: stackDeployEnv,
  mode: mode,
  dbConstructId: env.rds.db.constructId,
  dbName: env.rds.db.dbName,
  dbBackupRetention: env.rds.db.backupRetention,
  dbBackupPreferredWindow: env.rds.db.backupPreferredWindow,
  parameterGroupConstructId: env.rds.db.parameterGroupConstructId,
  bastionHostName: env.rds.bastion.hostName,
  bastionHostConstructId: env.rds.bastion.constructId,
  bastionHostKeyName: env.rds.bastion.keyName,
  masterUsername: env.rds.db.masterUsername,
  vpc: vpcStack.vpc,
  dbSecurityGroup: vpcStack.isolatedSg,
  bastionSecurityGroup: vpcStack.bastionSg,
});

const ecrStack = new EcrStack(app, env.ecr.stackId + envSuffix, {
  env: stackDeployEnv,
  mode: mode,
  webappRepoConstructId: env.ecr.webapp.constructId,
  webappRepoName: env.ecr.webapp.name,
  nginxRepoConstructId: env.ecr.nginx.constructId,
  nginxRepoName: env.ecr.nginx.name,
  celeryRepoConstructId: env.ecr.celery.constructId,
  celeryRepoName: env.ecr.celery.name,
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