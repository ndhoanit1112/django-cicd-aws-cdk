import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

interface ElbStackProps extends cdk.StackProps {
  lbConstructId: string;
  lbName: string;
  listenerConstructId: string;
  targetGroupConstructId: string;
  targetGroupName: string;
  healthCheckPath: string;
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
}

export class ElbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ElbStackProps) {
    super(scope, id, props);

    const lb = new elbv2.ApplicationLoadBalancer(this, props.lbConstructId, {
      vpc: props.vpc,
      loadBalancerName: props.lbName,
      internetFacing: true,
      securityGroup: props.securityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, props.targetGroupConstructId, {
      targetGroupName: props.targetGroupName,
      targetType: elbv2.TargetType.IP,
      vpc: props.vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      healthCheck: {
        path: props.healthCheckPath,
      }
    });

    const listener = lb.addListener(props.listenerConstructId, {
      port: 80,
      defaultTargetGroups: [targetGroup],
    });

    new cdk.CfnOutput(this, 'elbEndpoint', {
      value: lb.loadBalancerDnsName,
    });
  }
}
