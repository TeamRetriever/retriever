#!/usr/bin/env node

import {Command} from 'commander';
import chalk from 'chalk';
import {STSClient, GetCallerIdentityCommand} from '@aws-sdk/client-sts';
import ora from 'ora';
import inquirer from 'inquirer';
import {runConfigurationFlow, saveConfig, loadConfig, RetrieverConfig} from './config.js';
import {runTLSCertificateFlow} from './tls.js';
import {
  checkTerraformInstalled,
  validateTerraformDirectory,
  generateTerraformVars,
  terraformInit,
  terraformPlan,
  terraformApply,
  getTerraformOutputs
} from './terraform.js';

const ASCII_ART = `
${chalk.cyan('╔═══════════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}                                                               ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.yellow('██████╗ ███████╗████████╗██████╗ ██╗███████╗██╗   ██╗███████╗██████╗')} ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.yellow('██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██║██╔════╝██║   ██║██╔════╝██╔══██╗')}${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.yellow('██████╔╝█████╗     ██║   ██████╔╝██║█████╗  ██║   ██║█████╗  ██████╔╝')}${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.yellow('██╔══██╗██╔══╝     ██║   ██╔══██╗██║██╔══╝  ╚██╗ ██╔╝██╔══╝  ██╔══██╗')}${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.yellow('██║  ██║███████╗   ██║   ██║  ██║██║███████╗ ╚████╔╝ ███████╗██║  ██║')}${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.bold.yellow('╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝')}${chalk.cyan('║')}
${chalk.cyan('║')}                                                               ${chalk.cyan('║')}
${chalk.cyan('║')}        ${chalk.white('Self-Hosted Distributed Observability Platform')}       ${chalk.cyan('║')}
${chalk.cyan('║')}                                                               ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════════════════════╝')}
`;

interface AWSCredentials {
  account: string;
  userId: string;
  arn: string;
}

async function checkAWSCredentials(): Promise<AWSCredentials | null> {
  const spinner = ora('Checking AWS credentials...').start();

  try {
    const stsClient = new STSClient({});
    const command = new GetCallerIdentityCommand({});
    const response = await stsClient.send(command);

    if (!response.Account || !response.UserId || !response.Arn) {
      spinner.fail('AWS credentials check failed');
      return null;
    }

    spinner.succeed('AWS credentials verified');

    return {
      account: response.Account,
      userId: response.UserId,
      arn: response.Arn
    };
  } catch (error) {
    spinner.fail('AWS credentials not found or invalid');
    console.error(chalk.red('\nPlease configure your AWS credentials:'));
    console.error(chalk.yellow('  aws configure'));
    console.error(chalk.yellow('  or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables'));
    return null;
  }
}

async function init() {
  console.log(ASCII_ART);
  console.log(chalk.cyan('\nWelcome to Retriever CLI!\n'));
  console.log(chalk.white('This tool will help you deploy and manage your Retriever observability infrastructure.\n'));

  // Step 1: Verify AWS credentials
  const credentials = await checkAWSCredentials();

  if (!credentials) {
    process.exit(1);
  }

  console.log(chalk.green('\n✓ AWS Account:'), chalk.white(credentials.account));
  console.log(chalk.green('✓ User ARN:'), chalk.white(credentials.arn));

  // Step 2: Run interactive AWS configuration flow
  const awsConfig = await runConfigurationFlow();

  // Step 3: Run TLS certificate setup
  const tlsCert = await runTLSCertificateFlow(awsConfig.region);

  if (!tlsCert) {
    console.log(chalk.red('\nCertificate setup failed. Please run `retriever init` again.'));
    process.exit(1);
  }

  // Step 4: Combine and save complete configuration
  const completeConfig: RetrieverConfig = {
    ...awsConfig,
    certificateArn: tlsCert.certificateArn,
    domain: tlsCert.domain
  };

  await saveConfig(completeConfig);

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  console.log(chalk.green('✓ Configuration complete!\n'));
  console.log(chalk.yellow('Next steps:'));
  console.log(chalk.white('  1. Deploy observability stack (Jaeger, Prometheus, etc.)'));
  console.log(chalk.white('  2. Access your Retriever dashboard'));
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  console.log(chalk.green('\n🚀 Ready for deployment!'));
  console.log(chalk.white('\nRun'), chalk.cyan('retriever deploy'), chalk.white('to deploy the infrastructure.\n'));
}

async function deploy() {
  console.log(ASCII_ART);
  console.log(chalk.cyan('\nDeploying Retriever Infrastructure\n'));

  // Step 1: Load configuration
  const config = await loadConfig();

  if (!config) {
    console.error(chalk.red('\nNo configuration found!'));
    console.error(chalk.yellow('Please run'), chalk.cyan('retriever init'), chalk.yellow('first to configure your deployment.\n'));
    process.exit(1);
  }

  console.log(chalk.green('✓ Configuration loaded'));
  console.log(chalk.gray(`  Region: ${config.region}`));
  console.log(chalk.gray(`  VPC: ${config.vpcId}`));
  console.log(chalk.gray(`  Domain: ${config.domain}\n`));

  // Step 2: Verify AWS credentials
  const credentials = await checkAWSCredentials();

  if (!credentials) {
    process.exit(1);
  }

  console.log(chalk.green('✓ AWS Account:'), chalk.white(credentials.account));

  // Step 3: Check Terraform is installed
  if (!checkTerraformInstalled()) {
    console.error(chalk.red('\nTerraform is not installed!'));
    console.error(chalk.yellow('Please install Terraform from: https://www.terraform.io/downloads\n'));
    process.exit(1);
  }

  console.log(chalk.green('✓ Terraform installed'));

  // Step 4: Validate Terraform directory exists
  const terraformDirValid = await validateTerraformDirectory();

  if (!terraformDirValid) {
    process.exit(1);
  }

  console.log(chalk.green('✓ Terraform directory found'));

  // Step 5: Generate Terraform variables file
  const tfvarsSpinner = ora('Generating Terraform variables...').start();

  try {
    await generateTerraformVars(config);
    tfvarsSpinner.succeed('Terraform variables generated');
  } catch (error) {
    tfvarsSpinner.fail('Failed to generate Terraform variables');
    process.exit(1);
  }

  // Step 6: Initialize Terraform
  const initSuccess = await terraformInit();

  if (!initSuccess) {
    process.exit(1);
  }

  // Step 7: Run Terraform plan
  const planSuccess = await terraformPlan();

  if (!planSuccess) {
    process.exit(1);
  }

  // Step 8: Ask for confirmation
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  console.log(chalk.yellow('⚠️  This will create AWS resources in your account.'));
  console.log(chalk.yellow('   You may incur charges for ECS tasks, load balancer, and data transfer.\n'));

  const {confirm} = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to proceed with the deployment?',
      default: false
    }
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\nDeployment cancelled.\n'));
    process.exit(0);
  }

  // Step 9: Apply Terraform configuration
  const applySuccess = await terraformApply();

  if (!applySuccess) {
    console.error(chalk.red('\nDeployment failed. Please check the errors above.\n'));
    process.exit(1);
  }

  // Step 10: Get outputs and show success message
  const outputs = await getTerraformOutputs();

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  console.log(chalk.green('✅ Deployment Complete!\n'));

  console.log(chalk.white('Your Retriever observability platform is now running!\n'));

  if (config.domain) {
    console.log(chalk.yellow('Next steps:'));
    console.log(chalk.white(`  1. Point your DNS A record for ${chalk.cyan(config.domain)} to the load balancer`));
    console.log(chalk.white(`  2. Access Retriever at: ${chalk.cyan('https://' + config.domain)}`));
    console.log(chalk.white(`  3. Configure your applications to send traces to the collector\n`));
  }

  console.log(chalk.gray('Tip: Check the AWS Console to view your deployed resources.\n'));
}

const program = new Command();

program
  .name('retriever')
  .description('CLI for deploying and managing Retriever observability infrastructure')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize Retriever infrastructure in your AWS account')
  .action(init);

program
  .command('deploy')
  .description('Deploy Retriever observability stack to AWS')
  .action(deploy);

program.parse();