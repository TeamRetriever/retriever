#!/usr/bin/env node

import {Command} from 'commander';
import chalk from 'chalk';
import {STSClient, GetCallerIdentityCommand} from '@aws-sdk/client-sts';
import ora from 'ora';
import {runConfigurationFlow, saveConfig} from './config.js';

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

  // Step 2: Run interactive configuration flow
  const config = await runConfigurationFlow();

  // Step 3: Save configuration
  await saveConfig(config);

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  console.log(chalk.green('✓ Configuration complete!\n'));
  console.log(chalk.yellow('Next steps:'));
  console.log(chalk.white('  1. TLS certificate setup'));
  console.log(chalk.white('  2. Deploy observability stack (Jaeger, Prometheus, etc.)'));
  console.log(chalk.white('  3. Configure load balancer and DNS'));
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  console.log(chalk.green('\n🚀 Ready for deployment!'));
  console.log(chalk.gray('\n(Deployment commands coming soon...)\n'));
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

program.parse();