import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface SecretsManagerStackProps extends cdk.StackProps {
  djangoSecret: {
    constructId: string;
  };
  dbSecret: {
    constructId: string;
    username: string;
  };
  sqsUserSecret: {
    constructId: string;
    user: {
      constructId: string;
      userName: string;
      accessKeyConstructId: string;
    };
  };
}

export class SecretsManagerStack extends cdk.Stack {
  readonly djangoSecret: secretsmanager.ISecret;
  readonly dbSecret: secretsmanager.ISecret;
  readonly sqsUserSecret: secretsmanager.ISecret;
  constructor(scope: Construct, id: string, props: SecretsManagerStackProps) {
    super(scope, id, props);

    this.djangoSecret = new secretsmanager.Secret(this, props.djangoSecret.constructId, {
      generateSecretString: {
        requireEachIncludedType: false,
        excludePunctuation: true,
      },
      description: "Django secret key"
    });

    this.dbSecret = new secretsmanager.Secret(this, props.dbSecret.constructId, {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: props.dbSecret.username }),
        generateStringKey: 'password',
        excludePunctuation: true
      },
      description: "Database secret"
    });

    const user = new iam.User(this, props.sqsUserSecret.user.constructId, {
      userName: props.sqsUserSecret.user.userName,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSQSFullAccess"
        ),
      ],
    });

    const accessKey = new iam.AccessKey(this, props.sqsUserSecret.user.accessKeyConstructId, { user });
    this.sqsUserSecret = new secretsmanager.Secret(this, props.sqsUserSecret.constructId, {
      secretObjectValue: {
        username: cdk.SecretValue.unsafePlainText(user.userName),
        accessKeyId: cdk.SecretValue.unsafePlainText(accessKey.accessKeyId),
        secretAccessKey: accessKey.secretAccessKey,
      },
      description: "SQS User secret"
    });

    new cdk.CfnOutput(this, 'djangoSecretName', {
      value: this.djangoSecret.secretName,
    });

    new cdk.CfnOutput(this, 'dbSecretName', {
      value: this.dbSecret.secretName,
    });

    new cdk.CfnOutput(this, 'sqsUserSecretName', {
      value: this.sqsUserSecret.secretName,
    });
  }
}
