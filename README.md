# AWS CDK Infrastructure for Django CI/CD project

This AWS CDK (Cloud Development Kit) project provides infrastructure automation for deploying [Django deploy CI/CD project](https://github.com/ndhoanit1112/django-cicd-aws) on AWS.

## Prerequisites
Before getting started with this project, ensure that you have the following prerequisites:

* AWS CLI (https://aws.amazon.com/cli/)
* AWS CDK (https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install)
* Node.js (https://nodejs.org/en/download/)

## Getting Started
Follow these steps to set up and deploy the infrastructure:
1. Clone this repository to your local machine:
```bash
git clone https://github.com/ndhoanit1112/django-cicd-aws-cdk
cd django-cicd-aws-cdk
```
2. Modify some environment variables in the `env` folder:

   Open `env/dev.yml` and `env/prod.yml` files
* Update the ```connectionArn``` variable with the appropriate connection ARN.
* Update the ```keyName``` variable with the name of your key pair to access the bastion host ([create a keypair in AWS Console incase you don't have a key pair yet](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html#prepare-key-pair)).
* Update the ```region``` variable with the AWS region where you want to deploy the stacks.

3. Install project dependencies:
```bash
npm install
```
4. Configure your AWS credentials using the AWS CLI:
```bash
aws configure
```
5. Synthesizes AWS CloudFormation templates:
```bash
npx aws-cdk synth --all
```
6. Deploy the infrastructure stacks to AWS:
```bash
npx aws-cdk deploy --all
```
This command will deploy all the stacks defined in the project.
* __Note__: If you want to deploy to the production environment, add the DEPLOY_ENV=prod environment variable to your deployment command. For example:
```bash
DEPLOY_ENV=prod npx aws-cdk deploy --all
```

## Architecture
This project creates the following AWS resources:

* __VPC Stack__: Establishes a Virtual Private Cloud (VPC) with public and private subnets, routing tables, and internet gateway for network isolation and security.
* __Secrets Manager Stack__: Sets up AWS Secrets Manager to securely store sensitive information like database credentials.
* __ECR Stack__: Sets up the Elastic Container Registry (ECR) to store Docker container images for the Django application.
* __ECS Stack__: Creates an Elastic Container Service (ECS) cluster and task definitions for running the Django application as a containerized service.
* __ELB Stack__: Configures an Application Load Balancer (ALB) to distribute incoming traffic across the ECS service.
* __RDS Stack__: Deploys an Amazon RDS database instance to store the application's data.
* __SQS Stack__: Creates an Amazon Simple Queue Service (SQS) queue for handling background tasks or message processing. In this project, it is used to perform calculations of Fibonacci numbers as a background task.
* __Cache Stack__: Sets up a Memcached cluster to store and retrieve calculated Fibonacci numbers, reducing the need to recalculate them repeatedly.
* __Pipeline Stack__: Configures an AWS CodePipeline to automate the deployment process, triggering builds and deployments on every code change.
* __EFS Stack__: Sets up a shared file system between ECS tasks (This stack doesn't support the funtionality of the application, it is for study/experimental purpose).

## Clean Up
To remove the deployed infrastructure from your AWS account, run the following command:
```bash
npx aws-cdk destroy --all
```
This command will delete all the stacks created by the AWS CDK project.
