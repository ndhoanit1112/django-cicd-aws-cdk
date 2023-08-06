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
import { PipelineStack, PipelineStackProps } from '../lib/pipeline-stack';
import { SecretsManagerStack } from '../lib/secrets-manager-stack';
import { CacheStack, CacheStackProps } from '../lib/cache-stack';
import { EfsStack } from '../lib/efs-stack';

const app = new cdk.App();
const mode = process.env.DEPLOY_ENV === "prod" ? "prod" : "dev";
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

const secretsManagerStack = new SecretsManagerStack(app, env.secretsManager.stackId + envSuffix, {
  env: stackDeployEnv,
  ...env.secretsManager
});

const rdsStack = new RdsStack(app, env.rds.stackId + envSuffix, {
  env: stackDeployEnv,
  mode: mode,
  dbSecret: secretsManagerStack.dbSecret,
  vpc: vpcStack.vpc,
  dbSecurityGroup: vpcStack.isolatedSg,
  bastionSecurityGroup: vpcStack.bastionSg,
  ...env.rds
});

const efsStack = new EfsStack(app, env.efs.stackId + envSuffix, {
  env: stackDeployEnv,
  vpc: vpcStack.vpc,
  securityGroup: vpcStack.fileSystemSg,
  ...env.efs
});

const cacheProps: CacheStackProps = {
  env:stackDeployEnv,
  mode: mode,
  cacheSg: vpcStack.cacheSg,
  ...env.cache
};

cacheProps.subnetGroup.subnets = vpcStack.vpc.privateSubnets;

const cacheStack = new CacheStack(app, env.cache.stackId + envSuffix, cacheProps);

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
  fileSystem: efsStack.fileSystem,
  accessPoint: efsStack.accessPoint,
  ...env.ecs,
});

const sqsStack = new SqsStack(app, env.sqs.stackId + envSuffix, {
  env: stackDeployEnv,
  ...env.sqs
});

const pipelineProps: PipelineStackProps = {
  env: stackDeployEnv,
  mode: mode,
  vpc: vpcStack.vpc,
  privateSg: vpcStack.privateSg,
  webService: ecsStack.webService,
  celeryService: ecsStack.celeryService,
  webEcrRepository: ecrStack.webappRepository,
  celeryEcrRepository: ecrStack.celeryRepository,
  ...env.pipeline
};

pipelineProps.buildProject.env = {
  web: {
    containerName: env.ecs.container.web.name,
    ecrRepoUri: ecrStack.webappRepository.repositoryUri,
  },
  celery: {
    containerName: env.ecs.container.celery.name,
    ecrRepoUri: ecrStack.celeryRepository.repositoryUri,
  },
  dbInfo: rdsStack.dbInfo,
  dbSecret: secretsManagerStack.dbSecret,
  djangoSecret: secretsManagerStack.djangoSecret,
  sqsUserSecret: secretsManagerStack.sqsUserSecret,
  sqsRegion: stackDeployEnv.region,
  cacheInfo: {
    host: cacheStack.cacheCluster.attrConfigurationEndpointAddress,
    port: cacheStack.cacheCluster.attrConfigurationEndpointPort,
  },
};

const pipelineStack = new PipelineStack(app, env.pipeline.stackId + envSuffix, pipelineProps);

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