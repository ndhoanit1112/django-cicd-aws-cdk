import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

interface EcsStackProps extends cdk.StackProps {
  mode: "dev" | "prod";
  vpc: ec2.IVpc;
  clusterName: string;
  clusterConstructId: string;
  webServiceName: string;
  webServiceConstructId: string;
  webServiceDesiredCount: number;
  webTaskDefConstructId: string;
  webTaskDefName: string;
  webContainerId: string;
  webContainerName: string;
  webImageRepository: ecr.Repository;
  nginxContainerId: string;
  nginxContainerName: string;
  nginxContainerPortMappingName: string;
  nginxImageRepository: ecr.Repository;
  celeryServiceName: string;
  celeryServiceConstructId: string;
  celeryServiceDesiredCount: number;
  celeryTaskDefConstructId: string;
  celeryTaskDefName: string;
  celeryContainerId: string;
  celeryContainerName: string;
  celeryContainerEntryPoint: string;
  celeryContainerCommand: string;
  celeryContainerWorkingDir: string;
  celeryImageRepository: ecr.Repository;
  volumeName: string;
  webContainerMountPointPath: string;
  nginxContainerMountPointPath: string;
  privateSecurityGroup: ec2.ISecurityGroup;
  elbTargetGroup: elbv2.ApplicationTargetGroup;
}

export class EcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    // Cluster and Task definitions
    const cluster = new ecs.Cluster(this, props.clusterConstructId, {
      vpc: props.vpc,
      enableFargateCapacityProviders: true,
    });

    const webTaskDef = new ecs.FargateTaskDefinition(this, props.webTaskDefConstructId, {
      cpu: 256,
      memoryLimitMiB: 512,
      ephemeralStorageGiB: 21,
      family: props.webTaskDefName,
    });

    const nginxContainer = webTaskDef.addContainer(props.nginxContainerId, {
      containerName: props.nginxContainerName,
      image: ecs.ContainerImage.fromEcrRepository(props.nginxImageRepository),
      portMappings: [{
        containerPort: 80,
        appProtocol: ecs.AppProtocol.http,
        name: props.nginxContainerPortMappingName,
      }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs'
      }),
    });

    const webappContainer = webTaskDef.addContainer(props.webContainerId, {
      containerName: props.webContainerName,
      image: ecs.ContainerImage.fromEcrRepository(props.webImageRepository),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs'
      }),
    });

    const volume = {
      name: props.volumeName,
    };

    webTaskDef.addVolume(volume);
    webappContainer.addMountPoints({
      containerPath: props.webContainerMountPointPath,
      readOnly: false,
      sourceVolume: props.volumeName
    });
    nginxContainer.addMountPoints({
      containerPath: props.nginxContainerMountPointPath,
      readOnly: false,
      sourceVolume: props.volumeName
    });

    const celeryTaskDef = new ecs.FargateTaskDefinition(this, props.celeryTaskDefConstructId, {
      cpu: 256,
      memoryLimitMiB: 512,
      ephemeralStorageGiB: 21,
      family: props.celeryTaskDefName,
    });

    celeryTaskDef.addContainer(props.celeryContainerId, {
      containerName: props.celeryContainerName,
      image: ecs.ContainerImage.fromEcrRepository(props.celeryImageRepository),
      entryPoint: props.celeryContainerEntryPoint.split(','),
      command: [props.celeryContainerCommand],
      workingDirectory: props.celeryContainerWorkingDir,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs'
      }),
    });

    // Services
    const webService = new ecs.FargateService(this, props.webServiceConstructId, {
      cluster: cluster,
      taskDefinition: webTaskDef,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.privateSecurityGroup],
      serviceName: props.webServiceName,
      desiredCount: props.webServiceDesiredCount,
      assignPublicIp: false,
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: props.mode == "dev" ? 1 : 0,
        },
        {
          capacityProvider: 'FARGATE',
          weight: props.mode == "dev" ? 0 : 1,
        },
      ],
    });

    props.elbTargetGroup.addTarget(webService);

    const celeryService = new ecs.FargateService(this, props.celeryServiceConstructId, {
      cluster: cluster,
      taskDefinition: celeryTaskDef,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.privateSecurityGroup],
      serviceName: props.celeryServiceName,
      desiredCount: props.celeryServiceDesiredCount,
      assignPublicIp: false,
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: props.mode == "dev" ? 1 : 0,
        },
        {
          capacityProvider: 'FARGATE',
          weight: props.mode == "dev" ? 0 : 1,
        },
      ],
    });
  }
}
