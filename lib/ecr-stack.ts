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
  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    const webappRepository = new ecr.Repository(this, props.webappRepoConstructId, {
        repositoryName: props.webappRepoName,
        imageScanOnPush: true,
        removalPolicy: props.mode == "dev" ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
        autoDeleteImages: props.mode == "dev",
    });

    webappRepository.addLifecycleRule({
      maxImageAge: cdk.Duration.days(30),
    });

    const nginxRepository = new ecr.Repository(this, props.nginxRepoConstructId, {
        repositoryName: props.nginxRepoName,
        removalPolicy: props.mode == "dev" ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
        autoDeleteImages: props.mode == "dev",
    });

    nginxRepository.addLifecycleRule({
      maxImageAge: cdk.Duration.days(30),
    });

    const celeryRepository = new ecr.Repository(this, props.celeryRepoConstructId, {
        repositoryName: props.celeryRepoName,
        removalPolicy: props.mode == "dev" ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
        autoDeleteImages: props.mode == "dev",
    });

    celeryRepository.addLifecycleRule({
      maxImageAge: cdk.Duration.days(30),
    });
  }
}
