import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface VpcStackProps extends cdk.StackProps {
  vpcConstructId: string;
  vpcName: string;
  vpcCidr: string;
  sgPublicConstructId: string;
  sgPublicName: string;
  sgPrivateConstructId: string;
  sgPrivateName: string;
  sgBastionConstructId: string;
  sgBastionName: string;
  sgIsolatedConstructId: string;
  sgIsolatedName: string;
}

export class VpcStack extends cdk.Stack {
  readonly vpc: ec2.IVpc;
  readonly publicSg: ec2.ISecurityGroup;
  readonly privateSg: ec2.ISecurityGroup;
  readonly bastionSg: ec2.ISecurityGroup;
  readonly isolatedSg: ec2.ISecurityGroup;
  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, props.vpcConstructId, {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr),
      vpcName: props.vpcName,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 20,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 20,
        },
        {
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 20,
        },
      ],
      natGateways: 1,
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    this.publicSg = new ec2.SecurityGroup(this, props.sgPublicConstructId, {
      vpc: this.vpc,
      allowAllOutbound: true,
      securityGroupName: props.sgPublicName,
      description: 'Security group for public resources',
    });

    this.publicSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'allow HTTP traffic from anywhere',
    );

    this.publicSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'allow HTTPS traffic from anywhere',
    );

    this.privateSg = new ec2.SecurityGroup(this, props.sgPrivateConstructId, {
      vpc: this.vpc,
      allowAllOutbound: true,
      securityGroupName: props.sgPrivateName,
      description: 'Security group for private resources (ecs containers)',
    });

    this.privateSg.connections.allowFrom(
      new ec2.Connections({
        securityGroups: [this.publicSg],
      }),
      ec2.Port.tcp(8000),
      'allow traffic on port 8000 from public security group',
    );

    this.bastionSg = new ec2.SecurityGroup(this, props.sgBastionConstructId, {
      vpc: this.vpc,
      allowAllOutbound: true,
      securityGroupName: props.sgBastionName,
      description: 'Security group for bastion host (SSH tunel)'
    });

    this.bastionSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'allow SSH traffic from anywhere'
    );

    this.isolatedSg = new ec2.SecurityGroup(this, props.sgIsolatedConstructId, {
      vpc:this.vpc,
      allowAllOutbound: true,
      securityGroupName: props.sgIsolatedName,
      description: 'Security group for isolated resources (db)',
    });

    this.isolatedSg.connections.allowFrom(
      new ec2.Connections({
        securityGroups: [this.privateSg, this.bastionSg],
      }),
      ec2.Port.tcp(3306),
      'allow traffic on port 3306 from private/bastion security group',
    );
  }
}
