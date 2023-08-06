import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

interface EcsStackProps extends cdk.StackProps {
  mode: "dev" | "prod";
  vpc: ec2.IVpc;
  cluster: {
    constructId: string;
    name: string;
  };
  service: {
    web: {
      constructId: string;
      name: string;
      desiredCount: number;
    };
    celery: {
      constructId: string;
      name: string;
      desiredCount: number;
    };
  };
  taskDef: {
    web: {
      constructId: string;
      name: string;
      storage: {
        gunicornVolumeName: string;
        gunicornMountPointPath: {
          web: string;
          nginx: string;
        };
        efsVolumeName: string;
        efsMountPointPath: string;
      };
    };
    celery: {
      constructId: string;
      name: string;
      storage: {
        efsVolumeName: string;
        efsMountPointPath: string;
      }
    };
  };
  container: {
    web: {
      id: string;
      name: string;
    };
    nginx: {
      id: string;
      name: string;
      portMappingName: string;
    };
    celery: {
      id: string;
      name: string;
      entryPoint: string;
      command: string;
      workingDir: string;
    };
  };
  webImageRepository: ecr.Repository;
  nginxImageRepository: ecr.Repository;
  celeryImageRepository: ecr.Repository;
  privateSecurityGroup: ec2.ISecurityGroup;
  elbTargetGroup: elbv2.ApplicationTargetGroup;
  fileSystem: efs.FileSystem;
  accessPoint: efs.AccessPoint;
}

export class EcsStack extends cdk.Stack {
  readonly webService: ecs.FargateService;
  readonly celeryService: ecs.FargateService;
  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    // Cluster and Task definitions
    const cluster = new ecs.Cluster(this, props.cluster.constructId, {
      vpc: props.vpc,
      clusterName: props.cluster.name,
      enableFargateCapacityProviders: true,
    });

    const webTaskDef = new ecs.FargateTaskDefinition(this, props.taskDef.web.constructId, {
      cpu: 256,
      memoryLimitMiB: 512,
      ephemeralStorageGiB: 21,
      family: props.taskDef.web.name,
    });

    const nginxContainer = webTaskDef.addContainer(props.container.nginx.id, {
      containerName: props.container.nginx.name,
      image: ecs.ContainerImage.fromEcrRepository(props.nginxImageRepository),
      portMappings: [{
        containerPort: 80,
        appProtocol: ecs.AppProtocol.http,
        name: props.container.nginx.portMappingName,
      }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs'
      }),
    });

    const webappContainer = webTaskDef.addContainer(props.container.web.id, {
      containerName: props.container.web.name,
      image: ecs.ContainerImage.fromEcrRepository(props.webImageRepository),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs'
      }),
    });

    const volume = {
      name: props.taskDef.web.storage.gunicornVolumeName,
    };

    webTaskDef.addVolume(volume);
    webappContainer.addMountPoints({
      containerPath: props.taskDef.web.storage.gunicornMountPointPath.web,
      readOnly: false,
      sourceVolume: props.taskDef.web.storage.gunicornVolumeName,
    });
    nginxContainer.addMountPoints({
      containerPath: props.taskDef.web.storage.gunicornMountPointPath.nginx,
      readOnly: false,
      sourceVolume: props.taskDef.web.storage.gunicornVolumeName,
    });

    const efsWritePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "elasticfilesystem:ClientMount",
        "elasticfilesystem:ClientWrite"
      ],
      resources: [props.fileSystem.fileSystemArn],
      conditions: {
        StringEquals: {
          "elasticfilesystem:AccessPointArn": props.accessPoint.accessPointArn
        }
      },
    });

    webTaskDef.addToTaskRolePolicy(efsWritePolicy);

    webTaskDef.addVolume({
      name: props.taskDef.web.storage.efsVolumeName,
      efsVolumeConfiguration: {
        fileSystemId: props.fileSystem.fileSystemId,
        transitEncryption: "ENABLED",
        authorizationConfig: {
          accessPointId: props.accessPoint.accessPointId,
          iam: "ENABLED",
        }
      },
    });
    webappContainer.addMountPoints({
      containerPath: props.taskDef.web.storage.efsMountPointPath,
      readOnly: false,
      sourceVolume: props.taskDef.web.storage.efsVolumeName,
    });

    const celeryTaskDef = new ecs.FargateTaskDefinition(this, props.taskDef.celery.constructId, {
      cpu: 256,
      memoryLimitMiB: 512,
      ephemeralStorageGiB: 21,
      family: props.taskDef.celery.name,
    });

    const celeryContainer = celeryTaskDef.addContainer(props.container.celery.id, {
      containerName: props.container.celery.name,
      image: ecs.ContainerImage.fromEcrRepository(props.celeryImageRepository),
      entryPoint: props.container.celery.entryPoint.split(','),
      command: [props.container.celery.command],
      workingDirectory: props.container.celery.workingDir,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs'
      }),
    });

    const efsReadPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "elasticfilesystem:ClientMount",
        "elasticfilesystem:ClientRead"
      ],
      resources: [props.fileSystem.fileSystemArn],
      conditions: {
        StringEquals: {
          "elasticfilesystem:AccessPointArn": props.accessPoint.accessPointArn
        }
      },
    });

    celeryTaskDef.addToTaskRolePolicy(efsReadPolicy);

    celeryTaskDef.addVolume({
      name: props.taskDef.celery.storage.efsVolumeName,
      efsVolumeConfiguration: {
        fileSystemId: props.fileSystem.fileSystemId,
        transitEncryption: "ENABLED",
        authorizationConfig: {
          accessPointId: props.accessPoint.accessPointId,
          iam: "ENABLED",
        }
      },
    });
    celeryContainer.addMountPoints({
      containerPath: props.taskDef.celery.storage.efsMountPointPath,
      readOnly: false,
      sourceVolume: props.taskDef.celery.storage.efsVolumeName,
    });

    // Services
    this.webService = new ecs.FargateService(this, props.service.web.constructId, {
      cluster: cluster,
      taskDefinition: webTaskDef,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.privateSecurityGroup],
      serviceName: props.service.web.name,
      desiredCount: props.service.web.desiredCount,
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

    props.elbTargetGroup.addTarget(this.webService);

    this.celeryService = new ecs.FargateService(this, props.service.celery.constructId, {
      cluster: cluster,
      taskDefinition: celeryTaskDef,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.privateSecurityGroup],
      serviceName: props.service.celery.name,
      desiredCount: props.service.celery.desiredCount,
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
