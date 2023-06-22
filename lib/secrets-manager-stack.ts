import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface SecretsManagerStackProps extends cdk.StackProps {
  djangoSecret: {
    constructId: string;
  };
  dbSecret: {
    constructId: string;
    username: string;
  };
}

export class SecretsManagerStack extends cdk.Stack {
  readonly djangoSecret: secretsmanager.ISecret;
  readonly dbSecret: secretsmanager.ISecret;
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

    new cdk.CfnOutput(this, 'djangoSecretName', {
      value: this.djangoSecret.secretName,
    });

    new cdk.CfnOutput(this, 'dbSecretName', {
      value: this.dbSecret.secretName,
    });
  }
}
