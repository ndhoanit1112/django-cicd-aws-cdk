import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

export interface CacheStackProps extends cdk.StackProps {
  mode: "dev" | "prod";
  subnetGroup: {
    constructId: string;
    name: string;
    subnets: ec2.ISubnet[];
  };
  cacheCluster: {
    constructId: string;
  };
  cacheSg: ec2.ISecurityGroup;
}

export class CacheStack extends cdk.Stack {
  readonly cacheCluster: elasticache.CfnCacheCluster;
  constructor(scope: Construct, id: string, props: CacheStackProps) {
    super(scope, id, props);

    const subnetIds = props.subnetGroup.subnets.map(s => s.subnetId);
    const cacheSubnetGroup = new elasticache.CfnSubnetGroup(this, props.subnetGroup.constructId, {
      subnetIds: subnetIds,
      cacheSubnetGroupName: props.subnetGroup.name,
      description: "Subnet group for memcached",
    });

    this.cacheCluster = new elasticache.CfnCacheCluster(this, props.cacheCluster.constructId, {
      engine: "memcached",
      cacheNodeType: props.mode == "prod" ? "cache.t3.micro" : "cache.t2.micro",
      numCacheNodes: props.mode == "prod" ? 2 : 1,
      cacheSubnetGroupName: cacheSubnetGroup.ref,
      vpcSecurityGroupIds: [props.cacheSg.securityGroupId],
    });
  }
}
