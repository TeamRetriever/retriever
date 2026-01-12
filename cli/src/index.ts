#!/usr/bin/env node

import {Command} from 'commander';
import chalk from 'chalk';
import {STSClient, GetCallerIdentityCommand} from '@aws-sdk/client-sts';
import ora from 'ora';
import inquirer from 'inquirer';
import {runConfigurationFlow, saveConfig, loadConfig, RetrieverConfig} from './config.js';
import {runTLSCertificateFlow} from './tls.js';
import {
  runJWTSetupFlow,
  getSecretFromSecretsManager,
  createOrUpdateSecretInSecretsManager,
  generateJWTSecret,
  generateJWTToken,
  isTokenExpiringSoon,
  ensureSlackWebhookSecret
} from './secrets.js';
import {
  checkTerraformInstalled,
  validateTerraformDirectory,
  generateTerraformVars,
  ensureEcsTaskExecutionRole,
  setupS3Backend,
  terraformInit,
  terraformPlan,
  terraformApply,
  getTerraformOutputs,
  verifyServiceConnect
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

  // Step 4: JWT Secret and Token Setup
  const jwtToken = await runJWTSetupFlow(awsConfig.region);

  if (!jwtToken) {
    console.log(chalk.red('\nJWT setup failed. Your infrastructure can be deployed, but authentication will not work.'));
    console.log(chalk.yellow('You can manually create the secret "retriever/jwt-secret" in AWS Secrets Manager.'));
    // Don't exit - allow user to continue with deployment
  }

  // Step 5: Combine and save complete configuration
  const completeConfig: RetrieverConfig = {
    ...awsConfig,
    certificateArn: tlsCert.certificateArn,
    domain: tlsCert.domain,
    jwtToken: jwtToken || undefined
  };

  await saveConfig(completeConfig);

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  console.log(chalk.green('✓ Configuration complete!\n'));

  if (jwtToken) {
    console.log(chalk.green('✓ JWT Token generated and saved!'));
    console.log(chalk.gray('  Token is valid for 10 years'));
    console.log(chalk.gray('  Token saved to .retriever-config.json'));
    console.log(chalk.gray('  Use \'retriever generate-token\' to generate a new token anytime\n'));
  }

  console.log(chalk.yellow('Next steps:'));
  console.log(chalk.white('  1. Deploy observability stack (Jaeger, Prometheus, etc.)'));
  console.log(chalk.white('  2. Access your Retriever dashboard'));
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  console.log(chalk.green('\n🚀 Ready for deployment!'));
  console.log(chalk.white('\nRun'), chalk.cyan('retriever deploy'), chalk.white('to deploy the infrastructure.\n'));
}

async function deploy(options: { forceRecreate?: boolean } = {}) {
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

  // Step 3: Verify JWT secret exists and token is valid
  const secretsSpinner = ora('Checking JWT configuration...').start();

  try {
    // Check if secret exists in Secrets Manager
    const existingSecret = await getSecretFromSecretsManager(config.region);

    if (!existingSecret) {
      secretsSpinner.warn('JWT secret not found in Secrets Manager');
      console.log(chalk.yellow('⚠️  Creating JWT secret...'));

      const newSecret = generateJWTSecret();
      const created = await createOrUpdateSecretInSecretsManager(config.region, newSecret);

      if (!created) {
        secretsSpinner.fail('Failed to create JWT secret');
        console.log(chalk.yellow('Warning: Authentication will not work until JWT secret is created.'));
        console.log(chalk.yellow('You can continue with deployment, but manually create the secret later.\n'));
      } else {
        secretsSpinner.succeed('JWT secret created');

        // Generate new token with the new secret
        config.jwtToken = generateJWTToken(newSecret);
        await saveConfig(config);
      }
    } else {
      secretsSpinner.succeed('JWT secret verified');

      // Check if token exists and is valid
      if (!config.jwtToken) {
        console.log(chalk.yellow('⚠️  No JWT token found in config. Generating new token...'));
        config.jwtToken = generateJWTToken(existingSecret);
        await saveConfig(config);
        console.log(chalk.green('✓ Token generated and saved\n'));
      } else if (isTokenExpiringSoon(config.jwtToken, 30)) {
        console.log(chalk.yellow('⚠️  Token is expiring soon. Generating new token...'));
        config.jwtToken = generateJWTToken(existingSecret);
        await saveConfig(config);
        console.log(chalk.green('✓ New token generated and saved\n'));
      }
    }
  } catch (error) {
    secretsSpinner.fail('Failed to verify JWT configuration');
    console.log(chalk.yellow('Warning: Could not verify JWT setup. Proceeding with deployment.\n'));
  }

  // Step 4: Check Terraform is installed
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

  // Step 6: Ensure ECS task execution role exists
  const roleSuccess = await ensureEcsTaskExecutionRole();

  if (!roleSuccess) {
    process.exit(1);
  }

  // Step 7: Ensure Slack webhook secret exists
  const slackSecretSuccess = await ensureSlackWebhookSecret(config.region);

  if (!slackSecretSuccess) {
    console.log(chalk.yellow('\nWarning: Failed to setup Slack webhook secret.'));
    console.log(chalk.yellow('You can continue with deployment, but Alertmanager notifications won\'t work.\n'));

    const {continueAnyway} = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueAnyway',
        message: 'Continue with deployment anyway?',
        default: true
      }
    ]);

    if (!continueAnyway) {
      console.log(chalk.yellow('\nDeployment cancelled.\n'));
      process.exit(0);
    }
  }

  // Step 8: Setup S3 backend for state storage
  const backendConfigPath = await setupS3Backend(config.region);

  // Step 9: Initialize Terraform
  const initSuccess = await terraformInit(backendConfigPath);

  if (!initSuccess) {
    process.exit(1);
  }

  // Step 10: Run Terraform plan
  const planSuccess = await terraformPlan();

  if (!planSuccess) {
    process.exit(1);
  }

  // Step 11: Ask for confirmation
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

  // Step 12: Apply Terraform configuration
  const applySuccess = await terraformApply(options.forceRecreate || false, config.region);

  if (!applySuccess) {
    console.error(chalk.red('\nDeployment failed. Please check the errors above.\n'));
    process.exit(1);
  }

  // Step 13: Verify Service Connect configuration
  await verifyServiceConnect(config.region);

  // Step 14: Get outputs and show success message
  const outputs = await getTerraformOutputs();

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  console.log(chalk.green('✅ Deployment Complete!\n'));

  console.log(chalk.white('Your Retriever observability platform is now running!\n'));

  // Show Terraform outputs if available
  if (outputs.alb_dns_name?.value) {
    console.log(chalk.yellow('Load Balancer DNS:'), chalk.white(outputs.alb_dns_name.value));

    if (config.domain) {
      console.log(chalk.yellow('\nNext steps:'));
      console.log(chalk.white(`  1. Point your DNS A record for ${chalk.cyan(config.domain)} to:`));
      console.log(chalk.white(`     ${chalk.cyan(outputs.alb_dns_name.value)}`));
      console.log(chalk.white(`  2. Access Retriever at: ${chalk.cyan('https://' + config.domain)}`));
      console.log(chalk.white(`  3. Configure your applications to send traces to the collector\n`));
    }
  } else if (config.domain) {
    console.log(chalk.yellow('Next steps:'));
    console.log(chalk.white(`  1. Point your DNS A record for ${chalk.cyan(config.domain)} to the load balancer`));
    console.log(chalk.white(`  2. Access Retriever at: ${chalk.cyan('https://' + config.domain)}`));
    console.log(chalk.white(`  3. Configure your applications to send traces to the collector\n`));
  }

  // Display JWT token if available
  if (config.jwtToken) {
    console.log(chalk.cyan('\n━━━ Access Information ━━━\n'));
    console.log(chalk.yellow('Your JWT Access Token:'));
    console.log(chalk.white(`${config.jwtToken}\n`));
    console.log(chalk.gray('This token is required to:'));
    console.log(chalk.gray('  • Log in to the web UI (paste when prompted)'));
    console.log(chalk.gray('  • Access the MCP server (use as Bearer token)'));
    console.log(chalk.gray('  • Valid for 10 years from generation\n'));
    console.log(chalk.gray('Token also saved in .retriever-config.json\n'));
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
  .option('--force-recreate', 'Force recreation of all ECS services (fixes Service Connect configuration issues)')
  .action(deploy);

program
  .command('generate-token')
  .description('Generate a new JWT access token')
  .option('--regenerate-secret', 'Regenerate the JWT secret (invalidates all existing tokens)')
  .action(async (options: { regenerateSecret?: boolean }) => {
    console.log(ASCII_ART);
    console.log(chalk.cyan('\nGenerating JWT Access Token\n'));

    // Load configuration to get region
    const config = await loadConfig();

    if (!config) {
      console.error(chalk.red('\nNo configuration found!'));
      console.error(chalk.yellow('Please run'), chalk.cyan('retriever init'), chalk.yellow('first.\n'));
      process.exit(1);
    }

    console.log(chalk.green('✓ Configuration loaded'));
    console.log(chalk.gray(`  Region: ${config.region}\n`));

    // Verify AWS credentials
    const credentials = await checkAWSCredentials();

    if (!credentials) {
      process.exit(1);
    }

    console.log(chalk.green('✓ AWS Account:'), chalk.white(credentials.account));

    let secret: string;

    if (options.regenerateSecret) {
      // Regenerate secret
      console.log(chalk.yellow('\n⚠️  Regenerating JWT secret will invalidate ALL existing tokens!'));

      const {confirm} = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to regenerate the secret?',
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.yellow('\nOperation cancelled.\n'));
        process.exit(0);
      }

      console.log(chalk.cyan('\nGenerating new JWT secret...'));
      secret = generateJWTSecret();

      const updated = await createOrUpdateSecretInSecretsManager(config.region, secret);

      if (!updated) {
        console.error(chalk.red('\nFailed to update secret in Secrets Manager.\n'));
        process.exit(1);
      }

      console.log(chalk.green('✓ New secret stored in AWS Secrets Manager'));
    } else {
      // Use existing secret
      const spinner = ora('Retrieving JWT secret from AWS Secrets Manager...').start();

      const existingSecret = await getSecretFromSecretsManager(config.region);

      if (!existingSecret) {
        spinner.fail('JWT secret not found');
        console.error(chalk.red('\nNo JWT secret found in AWS Secrets Manager.'));
        console.error(chalk.yellow('Please run'), chalk.cyan('retriever init'), chalk.yellow('to create the secret, or use'), chalk.cyan('--regenerate-secret'), chalk.yellow('to create a new one.\n'));
        process.exit(1);
      }

      spinner.succeed('JWT secret retrieved');
      secret = existingSecret;
    }

    // Generate token
    const tokenSpinner = ora('Generating JWT token...').start();
    const token = generateJWTToken(secret);
    tokenSpinner.succeed('Token generated');

    // Save to config
    config.jwtToken = token;
    await saveConfig(config);

    // Display token
    console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    console.log(chalk.green('✅ JWT Token Generated!\n'));
    console.log(chalk.yellow('Your JWT Access Token:'));
    console.log(chalk.white(`${token}\n`));
    console.log(chalk.gray('This token is required to:'));
    console.log(chalk.gray('  • Log in to the Retriever web UI'));
    console.log(chalk.gray('  • Access the MCP server programmatically'));
    console.log(chalk.gray('\nToken Details:'));
    console.log(chalk.gray('  • Valid for: 10 years'));
    console.log(chalk.gray('  • Algorithm: HS256'));
    console.log(chalk.gray('  • Issuer: retriever'));
    console.log(chalk.gray('  • Audience: mcp\n'));
    console.log(chalk.green('✓ Token saved to .retriever-config.json\n'));
    console.log(chalk.gray('Tip: Copy this token and paste it when logging into the web UI.\n'));

    if (options.regenerateSecret) {
      console.log(chalk.yellow('⚠️  Warning: All previously generated tokens are now invalid.'));
      console.log(chalk.yellow('    Team members will need this new token to access Retriever.\n'));
    }
  });

program.parse();