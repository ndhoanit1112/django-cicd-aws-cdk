import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

interface EcrStackProps extends cdk.StackProps {
  mode: "dev" | "prod";
  webappRepoConstructId: string;
  webappRepoName: string;
  nginxRepoConstructId: string;
  nginxRepoName: string;
  celeryRepoConstructId: string;
  celeryRepoName: string;
}

export class EcrStack extends cdk.Stack {
  readonly webappRepository;
  readonly nginxRepository;
  readonly celeryRepository;
  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    this.webappRepository = new ecr.Repository(this, props.webappRepoConstructId, {
        repositoryName: props.webappRepoName,
        imageScanOnPush: true,
        removalPolicy: props.mode == "dev" ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
        autoDeleteImages: props.mode == "dev",
    });

    this.webappRepository.addLifecycleRule({
      maxImageAge: cdk.Duration.days(30),
    });

    this.nginxRepository = new ecr.Repository(this, props.nginxRepoConstructId, {
        repositoryName: props.nginxRepoName,
        removalPolicy: props.mode == "dev" ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
        autoDeleteImages: props.mode == "dev",
    });

    this.nginxRepository.addLifecycleRule({
      maxImageAge: cdk.Duration.days(30),
    });

    this.celeryRepository = new ecr.Repository(this, props.celeryRepoConstructId, {
        repositoryName: props.celeryRepoName,
        removalPolicy: props.mode == "dev" ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
        autoDeleteImages: props.mode == "dev",
    });

    this.celeryRepository.addLifecycleRule({
      maxImageAge: cdk.Duration.days(30),
    });
  }
}
