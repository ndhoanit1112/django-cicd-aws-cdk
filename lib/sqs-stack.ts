import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

interface SqsStackProps extends cdk.StackProps {
  mainQueue: {
    constructId: string;
    name: string;
    retentionPeriodInDays: number;
    visibilityTimeoutInHours: number;
  };
  dlQueue: {
    constructId: string;
    name: string;
    retentionPeriodInDays: number;
    visibilityTimeoutInHours: number;
    maxReceiveCount: number;
  };
  user: {
    constructId: string;
    userName: string;
    accessKeyConstructId: string;
    keySecretConstructId: string;
  };
}

export class SqsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SqsStackProps) {
    super(scope, id, props);

    const deadLetterQueue = new sqs.Queue(this, props.dlQueue.constructId, {
      queueName: props.dlQueue.name,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: cdk.Duration.days(props.dlQueue.retentionPeriodInDays),
      visibilityTimeout: cdk.Duration.hours(props.dlQueue.visibilityTimeoutInHours),
    });

    const mainQueue = new sqs.Queue(this, props.mainQueue.constructId, {
      queueName: props.mainQueue.name,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: cdk.Duration.days(props.mainQueue.retentionPeriodInDays),
      visibilityTimeout: cdk.Duration.hours(props.mainQueue.visibilityTimeoutInHours),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: props.dlQueue.maxReceiveCount,
      },
    });

    const user = new iam.User(this, props.user.constructId, {
      userName: props.user.userName,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSQSFullAccess"
        ),
      ],
    });

    const accessKey = new iam.AccessKey(this, props.user.accessKeyConstructId, { user });
    const secret = new secretsmanager.Secret(this, props.user.keySecretConstructId, {
      secretStringValue: accessKey.secretAccessKey,
    });

    new cdk.CfnOutput(this, 'userAccessKey', {
      value: accessKey.accessKeyId,
    });

    new cdk.CfnOutput(this, 'userKeySecretName', {
      value: secret.secretName,
    });
  }
}
