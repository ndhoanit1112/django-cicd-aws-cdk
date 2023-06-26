import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { DbInfo } from './rds-stack';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export interface PipelineStackProps extends cdk.StackProps {
  mode: "dev" | "prod";
  vpc: ec2.IVpc;
  privateSg: ec2.ISecurityGroup;
  webService: ecs.FargateService;
  celeryService: ecs.FargateService;
  webEcrRepository: ecr.IRepository;
  celeryEcrRepository: ecr.IRepository;
  pipeline: {
    constructId: string;
    name: string;
  };
  buildProject: {
    env: {
      web: {
        containerName: string;
        ecrRepoUri: string;
      };
      celery: {
        containerName: string;
        ecrRepoUri: string;
      };
      dbInfo: DbInfo;
      dbSecret: secretsmanager.ISecret;
      djangoSecret: secretsmanager.ISecret;
      sqsUserSecret: secretsmanager.ISecret;
      sqsRegion: string;
    };
    constructId: string;
    buildSpecFile: {
      dev: string;
      prod: string;
    };
    logGroup: {
      constructId: string;
      name: string;
    };
  };
  source: {
    repoName: string;
    owner: string;
    connectionArn: string;
  };
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const buidEnv: { [name: string]: codebuild.BuildEnvironmentVariable } = {
      "WEB_CONTAINER_NAME": { value: props.buildProject.env.web.containerName },
      "WEB_ECR_REPO_URI": { value: props.buildProject.env.web.ecrRepoUri },
      "CELERY_CONTAINER_NAME": { value: props.buildProject.env.celery.containerName },
      "CELERY_ECR_REPO_URI": { value: props.buildProject.env.celery.ecrRepoUri },
      "AWS_ACCOUNT_ID": { value: props.env?.account },
      "DB_NAME": { value: props.buildProject.env.dbInfo.name },
      "DB_USER": {
        value: `${props.buildProject.env.dbSecret.secretArn}:username`,
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
      },
      "DB_PASSWORD": {
        value: `${props.buildProject.env.dbSecret.secretArn}:password`,
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
      },
      "DB_HOST": { value: props.buildProject.env.dbInfo.endpoint },
      "DB_PORT": { value: props.buildProject.env.dbInfo.port },
      "DJANGO_SECRET_KEY": {
        value: props.buildProject.env.djangoSecret.secretArn,
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
      },
      "AWS_SQS_ACCESS_KEY_ID": {
        value: `${props.buildProject.env.sqsUserSecret.secretArn}:accessKeyId`,
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
      },
      "AWS_SQS_SECRET_ACCESS_KEY": {
        value: `${props.buildProject.env.sqsUserSecret.secretArn}:secretAccessKey`,
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
      },
      "AWS_SQS_REGION": { value: props.buildProject.env.sqsRegion }
    }

    const buildProject = new codebuild.PipelineProject(this, props.buildProject.constructId, {
      vpc: props.vpc,
      subnetSelection: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.privateSg],
      buildSpec: codebuild.BuildSpec.fromSourceFilename(
        props.mode == "dev"
        ? props.buildProject.buildSpecFile.dev
        : props.buildProject.buildSpecFile.prod
      ),
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_4,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true,
        environmentVariables: buidEnv,
      },
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, props.buildProject.logGroup.constructId, {
            logGroupName: props.buildProject.logGroup.name,
          }),
        },
      }
    });

    props.webEcrRepository.grantPullPush(buildProject);
    props.celeryEcrRepository.grantPullPush(buildProject);

    const sourceOutput = new codepipeline.Artifact();
    const webBuildOutput = new codepipeline.Artifact();

    const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: "GetSource",
      owner: props.source.owner,
      repo: props.source.repoName,
      branch: props.mode == "dev" ? "develop" : "master",
      output: sourceOutput,
      connectionArn: props.source.connectionArn,
    });

    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "BuildWebAndCelery",
      project: buildProject,
      input: sourceOutput,
      outputs: [webBuildOutput],
    });

    const webDeployAction = new codepipeline_actions.EcsDeployAction({
      actionName: "DeployWebApp",
      service: props.webService,
      input: webBuildOutput
    });

    const celeryDeployAction = new codepipeline_actions.EcsDeployAction({
      actionName: "DeployCelery",
      service: props.celeryService,
      imageFile: webBuildOutput.atPath("imagedefinitions_celery.json"),
    });

    const pipeline = new codepipeline.Pipeline(this, props.pipeline.constructId, {
      pipelineName: props.pipeline.name,
      stages: [
        {
          stageName: "Source",
          actions: [sourceAction],
        },
      ],
    });

    if (props.mode == "prod") {
      const approvalAction = new codepipeline_actions.ManualApprovalAction({
        actionName: "ManualApprove"
      });

      pipeline.addStage({
        stageName: "Approve",
        actions: [approvalAction],
      });
    }

    pipeline.addStage({
      stageName: "Build",
      actions: [buildAction],
    });

    pipeline.addStage({
      stageName: "Deploy",
      actions: [webDeployAction, celeryDeployAction],
    });
  }
}
