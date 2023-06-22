import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { DbInfo } from './rds-stack';

export interface PipelineStackProps extends cdk.StackProps {
  mode: "dev" | "prod";
  vpc: ec2.IVpc;
  privateSg: ec2.ISecurityGroup;
  buildProject: {
    common: {
      env: {
        dbInfo: DbInfo;
        dbSecret: secretsmanager.ISecret;
        djangoSecret: secretsmanager.ISecret;
        sqsAccessKey: string;
        sqsSecret: secretsmanager.ISecret;
        sqsRegion: string;
      };
    };
    web: {
      constructId: string;
      env: {
        containerName: string;
        ecrRepoUri: string;
      };
      buildSpecFile: string;
      logGroup: {
        constructId: string;
        name: string;
      };
    };
  };
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const commonEnv: { [name: string]: codebuild.BuildEnvironmentVariable } = {
      "AWS_ACCOUNT_ID": { value: props.env?.account },
      "DB_NAME": { value: props.buildProject.common.env.dbInfo.name },
      "DB_USER": {
        value: `${props.buildProject.common.env.dbSecret.secretArn}:username`,
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
      },
      "DB_PASSWORD": {
        value: `${props.buildProject.common.env.dbSecret.secretArn}:password`,
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
      },
      "DB_HOST": { value: props.buildProject.common.env.dbInfo.endpoint },
      "DB_PORT": { value: props.buildProject.common.env.dbInfo.port },
      "DJANGO_SECRET_KEY": {
        value: props.buildProject.common.env.djangoSecret.secretArn,
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
      },
      "AWS_SQS_ACCESS_KEY_ID": { value: props.buildProject.common.env.sqsAccessKey },
      "AWS_SQS_SECRET_ACCESS_KEY": {
        value: props.buildProject.common.env.sqsSecret.secretArn,
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
      },
      "AWS_SQS_REGION": { value: props.buildProject.common.env.sqsRegion }
    }

    const buildProject = new codebuild.PipelineProject(this, props.buildProject.web.constructId, {
      vpc: props.vpc,
      subnetSelection: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.privateSg],
      buildSpec: codebuild.BuildSpec.fromSourceFilename(props.buildProject.web.buildSpecFile),
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_4,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true,
        environmentVariables: {
          "CONTAINER_NAME": { value: props.buildProject.web.env.containerName },
          "ECR_REPO_URI": { value: props.buildProject.web.env.ecrRepoUri },
          ...commonEnv
        },
      },
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, props.buildProject.web.logGroup.constructId, {
            logGroupName: props.buildProject.web.logGroup.name,
          }),
        },
      }
    });
  }
}
