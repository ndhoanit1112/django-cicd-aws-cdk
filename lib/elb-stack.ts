import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

interface ElbStackProps extends cdk.StackProps {
  lb: {
    constructId: string;
    name: string;
  };
  listener: {
    constructId: string;
  };
  targetGroup: {
    constructId: string;
    name: string;
    healthCheckPath: string;
  };
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
}

export class ElbStack extends cdk.Stack {
  readonly targetGroup;
  constructor(scope: Construct, id: string, props: ElbStackProps) {
    super(scope, id, props);

    const lb = new elbv2.ApplicationLoadBalancer(this, props.lb.constructId, {
      vpc: props.vpc,
      loadBalancerName: props.lb.name,
      internetFacing: true,
      securityGroup: props.securityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
    });

    this.targetGroup = new elbv2.ApplicationTargetGroup(this, props.targetGroup.constructId, {
      targetGroupName: props.targetGroup.name,
      targetType: elbv2.TargetType.IP,
      vpc: props.vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      healthCheck: {
        path: props.targetGroup.healthCheckPath,
      }
    });

    const listener = lb.addListener(props.listener.constructId, {
      port: 80,
      defaultTargetGroups: [this.targetGroup],
    });

    new cdk.CfnOutput(this, 'elbEndpoint', {
      value: lb.loadBalancerDnsName,
    });
  }
}
