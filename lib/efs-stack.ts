import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface EfsStackProps extends cdk.StackProps {
  constructId: string;
  name: string;
  accessPoint: {
    id: string;
    path: string;
  };
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
}

export class EfsStack extends cdk.Stack {
  readonly fileSystem: efs.FileSystem;
  readonly accessPoint: efs.AccessPoint;
  constructor(scope: Construct, id: string, props: EfsStackProps) {
    super(scope, id, props);

    const fileSystemPolicy = new iam.PolicyDocument({
      statements: [new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        actions: ["*"],
        principals: [new iam.AnyPrincipal()],
        conditions: {
          Bool: {
            "aws:SecureTransport": "false",
          },
        },
      })],
    });

    this.fileSystem = new efs.FileSystem(this, props.constructId, {
      fileSystemName: props.name,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      },
      securityGroup: props.securityGroup,
      fileSystemPolicy: fileSystemPolicy,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_1_DAY,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      enableAutomaticBackups: false,
      outOfInfrequentAccessPolicy: efs.OutOfInfrequentAccessPolicy.AFTER_1_ACCESS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.accessPoint = this.fileSystem.addAccessPoint(props.accessPoint.id, {
      path: props.accessPoint.path,
      createAcl: {
        ownerGid: "1000",
        ownerUid: "1000",
        permissions: "755"
      },
        posixUser: {
        uid: "1000",
        gid: "1000"
      },
    });
  }
}
