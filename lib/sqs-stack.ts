import * as cdk from 'aws-cdk-lib';
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
  }
}
