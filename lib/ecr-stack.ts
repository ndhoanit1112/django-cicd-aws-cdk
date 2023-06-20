import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

interface EcrStackProps extends cdk.StackProps {
  mode: "dev" | "prod";
  webappRepo: {
    constructId: string;
    name: string;
  }
  nginxRepo: {
    constructId: string;
    name: string;
  }
  celeryRepo: {
    constructId: string;
    name: string;
  }
}

export class EcrStack extends cdk.Stack {
  readonly webappRepository;
  readonly nginxRepository;
  readonly celeryRepository;
  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    this.webappRepository = new ecr.Repository(this, props.webappRepo.constructId, {
        repositoryName: props.webappRepo.name,
        imageScanOnPush: true,
        removalPolicy: props.mode == "dev" ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
        autoDeleteImages: props.mode == "dev",
    });

    this.webappRepository.addLifecycleRule({
      maxImageAge: cdk.Duration.days(30),
    });

    this.nginxRepository = new ecr.Repository(this, props.nginxRepo.constructId, {
        repositoryName: props.nginxRepo.name,
        removalPolicy: props.mode == "dev" ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
        autoDeleteImages: props.mode == "dev",
    });

    this.nginxRepository.addLifecycleRule({
      maxImageAge: cdk.Duration.days(30),
    });

    this.celeryRepository = new ecr.Repository(this, props.celeryRepo.constructId, {
        repositoryName: props.celeryRepo.name,
        removalPolicy: props.mode == "dev" ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
        autoDeleteImages: props.mode == "dev",
    });

    this.celeryRepository.addLifecycleRule({
      maxImageAge: cdk.Duration.days(30),
    });
  }
}
