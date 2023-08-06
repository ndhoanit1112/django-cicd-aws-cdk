import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface VpcStackProps extends cdk.StackProps {
  mode: "dev" | "prod";
  vpc: {
    constructId: string;
    name: string;
    cidr: string;
  };
  securityGroup: {
    public: {
      constructId: string;
      name: string;
    };
    private: {
      constructId: string;
      name: string;
    };
    bastion: {
      constructId: string;
      name: string;
    };
    cache: {
      constructId: string;
      name: string;
    };
    fileSystem: {
      constructId: string;
      name: string;
    };
    isolated: {
      constructId: string;
      name: string;
    };
  };
}

export class VpcStack extends cdk.Stack {
  readonly vpc: ec2.IVpc;
  readonly publicSg: ec2.ISecurityGroup;
  readonly privateSg: ec2.ISecurityGroup;
  readonly bastionSg: ec2.ISecurityGroup;
  readonly cacheSg: ec2.ISecurityGroup;
  readonly fileSystemSg: ec2.ISecurityGroup;
  readonly isolatedSg: ec2.ISecurityGroup;
  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, props.vpc.constructId, {
      ipAddresses: ec2.IpAddresses.cidr(props.vpc.cidr),
      vpcName: props.vpc.name,
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
      natGateways: props.mode == "dev" ? 1 : 2,
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    this.publicSg = new ec2.SecurityGroup(this, props.securityGroup.public.constructId, {
      vpc: this.vpc,
      allowAllOutbound: true,
      securityGroupName: props.securityGroup.public.name,
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

    this.privateSg = new ec2.SecurityGroup(this, props.securityGroup.private.constructId, {
      vpc: this.vpc,
      allowAllOutbound: true,
      securityGroupName: props.securityGroup.private.name,
      description: 'Security group for private resources (ecs containers)',
    });

    this.privateSg.connections.allowFrom(
      new ec2.Connections({
        securityGroups: [this.publicSg],
      }),
      ec2.Port.tcp(80),
      'allow traffic on port 80 from public security group',
    );

    this.bastionSg = new ec2.SecurityGroup(this, props.securityGroup.bastion.constructId, {
      vpc: this.vpc,
      allowAllOutbound: true,
      securityGroupName: props.securityGroup.bastion.name,
      description: 'Security group for bastion host (SSH tunel)'
    });

    this.bastionSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'allow SSH traffic from anywhere'
    );

    this.cacheSg = new ec2.SecurityGroup(this, props.securityGroup.cache.constructId, {
      vpc: this.vpc,
      allowAllOutbound: true,
      securityGroupName: props.securityGroup.cache.name,
      description: 'Security group for cache cluster'
    });

    this.cacheSg.connections.allowFrom(
      new ec2.Connections({
        securityGroups: [this.privateSg],
      }),
      ec2.Port.tcp(11211),
      'allow traffic on port 11211 (memcached) from private sg'
    );

    this.fileSystemSg = new ec2.SecurityGroup(this, props.securityGroup.fileSystem.constructId, {
      vpc: this.vpc,
      allowAllOutbound: true,
      securityGroupName: props.securityGroup.fileSystem.name,
      description: 'Security group for EFS'
    });

    this.fileSystemSg.connections.allowFrom(
      new ec2.Connections({
        securityGroups: [this.privateSg],
      }),
      ec2.Port.tcp(2049),
      'allow traffic for the NFS protocol from private sg'
    );

    this.isolatedSg = new ec2.SecurityGroup(this, props.securityGroup.isolated.constructId, {
      vpc:this.vpc,
      allowAllOutbound: true,
      securityGroupName: props.securityGroup.isolated.name,
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
