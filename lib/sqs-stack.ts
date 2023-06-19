import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

interface SqsStackProps extends cdk.StackProps {
  mainQueueConstructId: string;
  mainQueueName: string;
  mainQueueRetentionPeriod: number;
  mainQueueVisibilityTimeout: number;
  dlQueueConstructId: string;
  dlQueueName: string;
  dlQueueRetentionPeriod: number;
  dlQueueVisibilityTimeout: number;
  dlQueueMaxReceiveCount: number;
  userConstructId: string;
  userName: string;
  accessKeyConstructId: string;
  keySecretConstructId: string;
}

export class SqsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SqsStackProps) {
    super(scope, id, props);

    const deadLetterQueue = new sqs.Queue(this, props.dlQueueConstructId, {
      queueName: props.dlQueueName,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: cdk.Duration.days(props.dlQueueRetentionPeriod),
      visibilityTimeout: cdk.Duration.hours(props.dlQueueVisibilityTimeout),
    });

    const mainQueue = new sqs.Queue(this, props.mainQueueConstructId, {
      queueName: props.mainQueueName,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: cdk.Duration.days(props.mainQueueRetentionPeriod),
      visibilityTimeout: cdk.Duration.hours(props.mainQueueVisibilityTimeout),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: props.dlQueueMaxReceiveCount,
      },
    });

    const user = new iam.User(this, props.userConstructId, {
      userName: props.userName,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSQSFullAccess"
        ),
      ],
    });

    const accessKey = new iam.AccessKey(this, props.accessKeyConstructId, { user });
    const secret = new secretsmanager.Secret(this, props.keySecretConstructId, {
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
