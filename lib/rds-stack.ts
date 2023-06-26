import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface RdsStackProps extends cdk.StackProps {
  mode: "dev" | "prod";
  db: {
    constructId: string;
    dbName: string;
    masterUsername: string;
    backupRetention: number;
    backupPreferredWindow: string;
    parameterGroupConstructId: string;
  };
  bastion: {
    constructId: string;
    hostName: string;
    keyName: string;
  };
  dbSecret: secretsmanager.ISecret;
  vpc: ec2.IVpc;
  dbSecurityGroup: ec2.ISecurityGroup;
  bastionSecurityGroup: ec2.ISecurityGroup;
}

export interface DbInfo {
  name: string;
  endpoint: string;
  port: number;
}

export class RdsStack extends cdk.Stack {
  readonly dbInfo: DbInfo;
  constructor(scope: Construct, id: string, props: RdsStackProps) {
    super(scope, id, props);

    const bastionHostInstance = new ec2.Instance(this, props.bastion.constructId, {
        vpc: props.vpc,
        instanceName: props.bastion.hostName,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
        securityGroup: props.bastionSecurityGroup,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T2,
          ec2.InstanceSize.MICRO,
        ),
        machineImage: new ec2.AmazonLinuxImage({
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
        }),
        keyName: props.bastion.keyName,
      });

    if (props.mode == "prod") {
      const parameterGroup = new rds.ParameterGroup(this, props.db.parameterGroupConstructId, {
        engine: rds.DatabaseClusterEngine.auroraMysql({
          version: rds.AuroraMysqlEngineVersion.VER_3_02_2,
        }),
        parameters: {
          ["time_zone"]: "Asia/Tokyo",
          ["general_log"]: "1",
          ["log_output"]: "FILE",
          ["character_set_client"]: "utf8mb4",
          ["character_set_connection"]: "utf8mb4",
          ["character_set_database"]: "utf8mb4",
          ["character_set_results"]: "utf8mb4",
          ["character_set_server"]: "utf8mb4",
        },
      });

      const cluster = new rds.DatabaseCluster(this, props.db.constructId, {
        vpc: props.vpc,
        clusterIdentifier: props.db.constructId,
        engine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_3_02_2 }),
        credentials: rds.Credentials.fromPassword(
          props.dbSecret.secretValueFromJson("username").unsafeUnwrap(),
          props.dbSecret.secretValueFromJson("password"),
        ),
        parameterGroup: parameterGroup,
        writer: rds.ClusterInstance.provisioned('writer', {
          publiclyAccessible: false,
          instanceType: ec2.InstanceType.of(
            ec2.InstanceClass.T3,
            ec2.InstanceSize.MEDIUM,
          ),
        }),
        readers: [
          rds.ClusterInstance.provisioned('reader', {
            promotionTier: 1,
            instanceType: ec2.InstanceType.of(
              ec2.InstanceClass.T3,
              ec2.InstanceSize.MEDIUM,
            ),
          }),
        ],
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        securityGroups: [props.dbSecurityGroup],
        defaultDatabaseName: props.db.dbName,
        instanceUpdateBehaviour: rds.InstanceUpdateBehaviour.ROLLING,
        backup: {
          retention: cdk.Duration.days(props.db.backupRetention),
          preferredWindow: props.db.backupPreferredWindow,
        }
      });

      this.dbInfo = {
        name: props.db.dbName,
        endpoint: cluster.clusterEndpoint.hostname,
        port: cluster.clusterEndpoint.port,
      };

    } else {
      const parameterGroup = new rds.ParameterGroup(this, props.db.parameterGroupConstructId, {
        engine: rds.DatabaseInstanceEngine.mysql({
          version: rds.MysqlEngineVersion.VER_8_0_32
        }),
        parameters: {
          ["time_zone"]: "Asia/Tokyo",
          ["general_log"]: "1",
          ["log_output"]: "FILE",
          ["character_set_client"]: "utf8mb4",
          ["character_set_connection"]: "utf8mb4",
          ["character_set_database"]: "utf8mb4",
          ["character_set_results"]: "utf8mb4",
          ["character_set_server"]: "utf8mb4",
        },
      });

      const dbInstance = new rds.DatabaseInstance(this, props.db.constructId, {
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        securityGroups: [props.dbSecurityGroup],
        engine: rds.DatabaseInstanceEngine.mysql({
          version: rds.MysqlEngineVersion.VER_8_0_32
        }),
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MICRO,
        ),
        parameterGroup: parameterGroup,
        credentials: rds.Credentials.fromPassword(
          props.dbSecret.secretValueFromJson("username").unsafeUnwrap(),
          props.dbSecret.secretValueFromJson("password"),
        ),
        multiAz: false,
        allocatedStorage: 20,
        maxAllocatedStorage: 1000,
        allowMajorVersionUpgrade: false,
        autoMinorVersionUpgrade: true,
        backupRetention: cdk.Duration.days(0),
        deleteAutomatedBackups: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        deletionProtection: false,
        databaseName: props.db.dbName,
        publiclyAccessible: false,
      });

      this.dbInfo = {
        name: props.db.dbName,
        endpoint: dbInstance.instanceEndpoint.hostname,
        port: dbInstance.instanceEndpoint.port,
      };
    }
  
    new cdk.CfnOutput(this, 'dbEndpoint', {
      value: this.dbInfo.endpoint,
    });

    new cdk.CfnOutput(this, 'bastionHostIP', {
      value: bastionHostInstance.instancePublicIp,
    });
  }
}
