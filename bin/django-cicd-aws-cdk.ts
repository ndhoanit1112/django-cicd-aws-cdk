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

const elbStack = new ElbStack(app, env.elb.stackId + envSuffix, {
  env: stackDeployEnv,
  lbConstructId: env.elb.lb.constructId,
  lbName: env.elb.lb.name,
  listenerConstructId: env.elb.listener.constructId,
  targetGroupConstructId: env.elb.targetGroup.constructId,
  targetGroupName: env.elb.targetGroup.name,
  healthCheckPath: env.elb.targetGroup.healthCheckPath,
  vpc: vpcStack.vpc,
  securityGroup: vpcStack.publicSg,
});

const ecsStack = new EcsStack(app, env.ecs.stackId + envSuffix, {
  env: stackDeployEnv,
  mode: mode,
  vpc: vpcStack.vpc,
  clusterName: env.ecs.cluster.name,
  clusterConstructId: env.ecs.cluster.constructId,
  webServiceName: env.ecs.service.web.name,
  webServiceConstructId: env.ecs.service.web.constructId,
  webServiceDesiredCount: env.ecs.service.web.desiredCount,
  webTaskDefConstructId: env.ecs.taskDef.web.constructId,
  webTaskDefName: env.ecs.taskDef.web.name,
  webContainerId: env.ecs.container.web.id,
  webContainerName: env.ecs.container.web.name,
  webImageRepository: ecrStack.webappRepository,
  nginxContainerId: env.ecs.container.nginx.id,
  nginxContainerName: env.ecs.container.nginx.name,
  nginxContainerPortMappingName: env.ecs.container.nginx.portMappingName,
  nginxImageRepository: ecrStack.nginxRepository,
  celeryServiceName: env.ecs.service.celery.name,
  celeryServiceConstructId: env.ecs.service.celery.constructId,
  celeryServiceDesiredCount: env.ecs.service.celery.desiredCount,
  celeryTaskDefConstructId: env.ecs.taskDef.celery.constructId,
  celeryTaskDefName: env.ecs.taskDef.celery.name,
  celeryContainerId: env.ecs.container.celery.id,
  celeryContainerName: env.ecs.container.celery.name,
  celeryContainerEntryPoint: env.ecs.container.celery.entryPoint,
  celeryContainerCommand: env.ecs.container.celery.command,
  celeryContainerWorkingDir: env.ecs.container.celery.workingDir,
  celeryImageRepository: ecrStack.celeryRepository,
  volumeName: env.ecs.taskDef.web.storage.volumeName,
  webContainerMountPointPath: env.ecs.taskDef.web.storage.mountPointPath.web,
  nginxContainerMountPointPath: env.ecs.taskDef.web.storage.mountPointPath.nginx,
  privateSecurityGroup: vpcStack.privateSg,
  elbTargetGroup: elbStack.targetGroup,
});

const sqsStack = new SqsStack(app, env.sqs.stackId, {
  env: stackDeployEnv,
  mainQueueConstructId: env.sqs.mainQueue.constructId,
  mainQueueName: env.sqs.mainQueue.name,
  mainQueueRetentionPeriod: env.sqs.mainQueue.retentionPeriodInDays,
  mainQueueVisibilityTimeout: env.sqs.mainQueue.visibilityTimeoutInHours,
  dlQueueConstructId: env.sqs.dlQueue.constructId,
  dlQueueName: env.sqs.dlQueue.name,
  dlQueueRetentionPeriod: env.sqs.dlQueue.retentionPeriodInDays,
  dlQueueVisibilityTimeout: env.sqs.dlQueue.visibilityTimeoutInHours,
  dlQueueMaxReceiveCount: env.sqs.dlQueue.maxReceiveCount,
  userConstructId: env.sqs.user.constructId,
  userName: env.sqs.user.userName,
  accessKeyConstructId: env.sqs.user.accessKeyConstructId,
  keySecretConstructId: env.sqs.user.keySecretConstructId,
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