import {
  SecretsManagerClient,
  CreateSecretCommand,
  UpdateSecretCommand,
  GetSecretValueCommand,
  DescribeSecretCommand,
  ResourceNotFoundException
} from '@aws-sdk/client-secrets-manager';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

const JWT_SECRET_NAME = 'retriever/jwt-secret';

/**
 * Generates a cryptographically secure JWT secret
 *
 * Why: JWT tokens need to be signed with a strong secret to prevent
 * forgery. We use 32 bytes (256 bits) of cryptographically secure
 * random data, which is the recommended minimum for HS256.
 *
 * @returns A 64-character hex string (32 bytes)
 */
export function generateJWTSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates or updates the JWT secret in AWS Secrets Manager
 *
 * Why: AWS Secrets Manager provides encrypted storage for sensitive data
 * and integrates seamlessly with ECS. ECS tasks can automatically retrieve
 * secrets at runtime without hardcoding them in the application.
 *
 * The secret is stored at 'retriever/jwt-secret' which matches what
 * Terraform expects (see infrastructure/secrets.tf).
 *
 * @param region AWS region where secret should be stored
 * @param secretValue The JWT secret to store
 * @returns true if successful, false otherwise
 */
export async function createOrUpdateSecretInSecretsManager(
  region: string,
  secretValue: string
): Promise<boolean> {
  const client = new SecretsManagerClient({region});
  const spinner = ora('Storing JWT secret in AWS Secrets Manager...').start();

  try {
    // Try to describe the secret first to see if it exists
    try {
      await client.send(
        new DescribeSecretCommand({
          SecretId: JWT_SECRET_NAME
        })
      );

      // Secret exists, update it
      await client.send(
        new UpdateSecretCommand({
          SecretId: JWT_SECRET_NAME,
          SecretString: secretValue
        })
      );

      spinner.succeed('JWT secret updated in AWS Secrets Manager');
      console.log(chalk.gray(`  Secret: ${JWT_SECRET_NAME}`));
      return true;
    } catch (error: any) {
      if (error instanceof ResourceNotFoundException) {
        // Secret doesn't exist, create it
        const response = await client.send(
          new CreateSecretCommand({
            Name: JWT_SECRET_NAME,
            SecretString: secretValue,
            Description: 'JWT secret for Retriever authentication',
            Tags: [
              {
                Key: 'ManagedBy',
                Value: 'Retriever-CLI'
              }
            ]
          })
        );

        spinner.succeed('JWT secret created in AWS Secrets Manager');
        if (response.ARN) {
          console.log(chalk.gray(`  ARN: ${response.ARN}`));
        }
        return true;
      }
      // Re-throw non-ResourceNotFound errors to outer catch
      throw error;
    }
  } catch (error: any) {
    spinner.fail('Failed to store JWT secret');

    if (error.name === 'AccessDeniedException') {
      console.error(chalk.red('\nAWS Secrets Manager permission denied.'));
      console.error(chalk.yellow('\nYour IAM user/role needs these permissions:'));
      console.error(chalk.white('  • secretsmanager:CreateSecret'));
      console.error(chalk.white('  • secretsmanager:UpdateSecret'));
      console.error(chalk.white('  • secretsmanager:GetSecretValue'));
      console.error(chalk.white('  • secretsmanager:DescribeSecret'));
      console.error(chalk.yellow('\nAdd these permissions to your IAM policy and try again.\n'));
    } else if (error.name === 'NetworkingError' || error.code === 'ENOTFOUND') {
      console.error(chalk.red('\nCould not connect to AWS Secrets Manager.'));
      console.error(chalk.yellow('Please check:'));
      console.error(chalk.white('  • Your internet connection'));
      console.error(chalk.white('  • AWS service status (status.aws.amazon.com)'));
      console.error(chalk.white(`  • Your AWS region is correct: ${region}\n`));
    } else {
      console.error(chalk.red('\nError:'), error.message);
    }

    return false;
  }
}

/**
 * Retrieves the JWT secret from AWS Secrets Manager
 *
 * Why: When generating new tokens, we need to use the same secret that's
 * stored in Secrets Manager and used by the ECS tasks. This ensures all
 * tokens are signed with the same secret and can be validated.
 *
 * @param region AWS region where secret is stored
 * @returns The secret string or null if not found/error
 */
export async function getSecretFromSecretsManager(region: string): Promise<string | null> {
  const client = new SecretsManagerClient({region});

  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: JWT_SECRET_NAME
      })
    );

    return response.SecretString || null;
  } catch (error: any) {
    if (error instanceof ResourceNotFoundException) {
      // Secret doesn't exist, return null
      return null;
    }

    // Log error but don't fail - let caller handle it
    if (error.name === 'AccessDeniedException') {
      console.error(chalk.yellow('\nWarning: Permission denied when retrieving JWT secret.'));
    } else {
      console.error(chalk.yellow('\nWarning: Could not retrieve JWT secret:'), error.message);
    }

    return null;
  }
}

/**
 * Generates a JWT token signed with the provided secret
 *
 * Why: This token is used to authenticate users accessing the web UI
 * (via auth-proxy) and the MCP server. The token structure must match
 * exactly what the auth-proxy and MCP server expect for validation.
 *
 * Token claims:
 * - iss (issuer): 'retriever' - identifies this as a Retriever token
 * - sub (subject): 'mcp-access' - what the token grants access to
 * - aud (audience): 'mcp' - who should accept this token
 *
 * The token is valid for 10 years by default, which provides long-term
 * access without frequent regeneration. Users can regenerate anytime.
 *
 * @param secret The JWT secret to sign with
 * @param expiresIn Token expiration (default: 3650 days = 10 years)
 * @returns Signed JWT token string
 */
export function generateJWTToken(secret: string, expiresIn: string = '3650d'): string {
  const payload = {
    iss: 'retriever',
    sub: 'mcp-access',
    aud: 'mcp'
  };

  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn
  } as jwt.SignOptions);
}

/**
 * Checks if a JWT token is expiring soon or already expired
 *
 * Why: We want to proactively regenerate tokens before they expire to
 * avoid service disruption. If a token expires within the threshold
 * (default 30 days), we'll regenerate it during deployment.
 *
 * @param token JWT token string to check
 * @param daysThreshold Days before expiration to consider "expiring soon"
 * @returns true if token expires within threshold days or is expired
 */
export function isTokenExpiringSoon(token: string, daysThreshold: number = 30): boolean {
  try {
    // Decode without verification (we just need the expiration time)
    const decoded = jwt.decode(token) as { exp?: number };

    if (!decoded || !decoded.exp) {
      // Invalid token or no expiration - treat as expired
      return true;
    }

    const expirationDate = new Date(decoded.exp * 1000);
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    // Return true if already expired or expires within threshold
    return expirationDate <= thresholdDate;
  } catch (error) {
    // If we can't decode the token, treat it as expired
    return true;
  }
}

/**
 * Interactive flow for JWT secret and token setup during initialization
 *
 * Flow:
 * 1. Check if JWT secret already exists in Secrets Manager
 * 2. If exists: Ask user if they want to use existing or create new
 * 3. If not exists: Generate new secret
 * 4. Store secret in Secrets Manager
 * 5. Generate initial JWT token
 * 6. Return token for storage in config
 *
 * Why this approach:
 * - Allows re-running init without breaking existing deployments
 * - Gives users control over whether to reuse or regenerate secrets
 * - Handles both fresh installs and updates gracefully
 *
 * @param region AWS region for Secrets Manager
 * @returns Generated JWT token or null if setup failed
 */
export async function runJWTSetupFlow(region: string): Promise<string | null> {
  console.log(chalk.cyan('\n━━━ JWT Authentication Setup ━━━\n'));

  console.log(chalk.white('Retriever uses JWT tokens to secure access to your observability platform.'));
  console.log(chalk.white('We\'ll create a secret in AWS Secrets Manager and generate your first access token.\n'));

  // Step 1: Check for existing secret
  const checkSpinner = ora('Checking for existing JWT secret...').start();
  const existingSecret = await getSecretFromSecretsManager(region);

  let secret: string;

  if (existingSecret) {
    checkSpinner.succeed('Found existing JWT secret in Secrets Manager');

    const {useExisting} = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useExisting',
        message: 'Use the existing JWT secret?',
        default: true
      }
    ]);

    if (useExisting) {
      secret = existingSecret;
      console.log(chalk.green('✓ Using existing JWT secret'));
    } else {
      console.log(chalk.yellow('\nGenerating new JWT secret...'));
      secret = generateJWTSecret();
      console.log(chalk.green('✓ New JWT secret generated (32 bytes, cryptographically secure)'));

      const success = await createOrUpdateSecretInSecretsManager(region, secret);
      if (!success) {
        return null;
      }
    }
  } else {
    checkSpinner.succeed('No existing JWT secret found');
    console.log(chalk.cyan('\nGenerating new JWT secret...'));
    secret = generateJWTSecret();
    console.log(chalk.green('✓ JWT secret generated (32 bytes, cryptographically secure)'));

    const success = await createOrUpdateSecretInSecretsManager(region, secret);
    if (!success) {
      return null;
    }
  }

  // Step 2: Generate JWT token
  const tokenSpinner = ora('Generating JWT access token...').start();
  try {
    const token = generateJWTToken(secret);
    tokenSpinner.succeed('JWT access token generated (valid for 10 years)');
    return token;
  } catch (error: any) {
    tokenSpinner.fail('Failed to generate JWT token');
    console.error(chalk.red('Error:'), error.message);
    return null;
  }
}

/**
 * Ensures the Slack webhook secret exists in AWS Secrets Manager
 *
 * Why: Terraform expects this secret to exist for Alertmanager configuration.
 * If users don't want Slack notifications, we create a placeholder secret
 * so Terraform doesn't fail. They can update it later if needed.
 *
 * @param region AWS region for Secrets Manager
 * @returns true if secret exists or was created successfully
 */
export async function ensureSlackWebhookSecret(region: string): Promise<boolean> {
  const SLACK_SECRET_NAME = 'retriever-slack-webhookurl';
  const client = new SecretsManagerClient({region});

  try {
    // Check if the secret already exists
    await client.send(
      new DescribeSecretCommand({
        SecretId: SLACK_SECRET_NAME
      })
    );

    // Secret exists, we're good
    return true;
  } catch (error: any) {
    if (error instanceof ResourceNotFoundException) {
      // Secret doesn't exist, ask user if they want to set it up
      console.log(chalk.yellow('\n⚠️  Slack webhook secret not found.'));
      console.log(chalk.white('Alertmanager can send notifications to Slack, but it\'s optional.\n'));

      const {setupSlack} = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'setupSlack',
          message: 'Do you want to configure Slack notifications now?',
          default: false
        }
      ]);

      let webhookUrl: string;

      if (setupSlack) {
        const {url} = await inquirer.prompt([
          {
            type: 'input',
            name: 'url',
            message: 'Enter your Slack webhook URL:',
            validate: (input: string) => {
              if (!input) return 'Webhook URL is required';
              if (!input.startsWith('https://hooks.slack.com/')) {
                return 'Invalid Slack webhook URL. Should start with https://hooks.slack.com/';
              }
              return true;
            }
          }
        ]);
        webhookUrl = url;
      } else {
        console.log(chalk.gray('Creating placeholder secret. You can update it later if needed.'));
        webhookUrl = 'https://hooks.slack.com/placeholder';
      }

      // Create the secret
      const spinner = ora('Creating Slack webhook secret...').start();
      try {
        await client.send(
          new CreateSecretCommand({
            Name: SLACK_SECRET_NAME,
            SecretString: webhookUrl,
            Description: 'Slack webhook URL for Alertmanager notifications',
            Tags: [
              {
                Key: 'ManagedBy',
                Value: 'Retriever-CLI'
              }
            ]
          })
        );

        spinner.succeed('Slack webhook secret created');
        if (!setupSlack) {
          console.log(chalk.gray('  Using placeholder URL (update in AWS Secrets Manager to enable Slack)\n'));
        }
        return true;
      } catch (createError: any) {
        spinner.fail('Failed to create Slack webhook secret');
        console.error(chalk.red('Error:'), createError.message);
        return false;
      }
    }

    // Other error
    console.error(chalk.red('Error checking Slack webhook secret:'), error.message);
    return false;
  }
}