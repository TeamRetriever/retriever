import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { listVPCs, listSubnets, VPCInfo, SubnetInfo } from './aws-utils.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Configuration that will be saved for the Retriever deployment
 */
export interface RetrieverConfig {
  region: string;
  vpcId: string;
  publicSubnetId1: string;
  publicSubnetId2: string;
  privateSubnetId: string;
  certificateArn?: string;
  domain?: string;
}

/**
 * AWS regions commonly used
 * Why: We offer a curated list of regions rather than all ~30 regions
 * to keep the selection manageable. Users can still pick any region.
 */
const COMMON_REGIONS = [
  { name: 'US East (N. Virginia)', value: 'us-east-1' },
  { name: 'US East (Ohio)', value: 'us-east-2' },
  { name: 'US West (Oregon)', value: 'us-west-2' },
  { name: 'US West (N. California)', value: 'us-west-1' },
  { name: 'EU (Ireland)', value: 'eu-west-1' },
  { name: 'EU (Frankfurt)', value: 'eu-central-1' },
  { name: 'Asia Pacific (Tokyo)', value: 'ap-northeast-1' },
  { name: 'Asia Pacific (Singapore)', value: 'ap-southeast-1' },
  { name: 'Asia Pacific (Sydney)', value: 'ap-southeast-2' }
];

/**
 * Path where configuration will be saved
 */
const CONFIG_FILE_PATH = path.join(process.cwd(), '.retriever-config.json');

/**
 * Runs the interactive configuration flow
 *
 * This guides users through selecting their AWS resources:
 * 1. Region - where to deploy
 * 2. VPC - which VPC to use
 * 3. Subnets - 2 public subnets (different AZs) + 1 private subnet
 *
 * Why this order:
 * - Region first because all resources are region-specific
 * - VPC second because subnets belong to a VPC
 * - Subnets last because we need VPC context
 */
export async function runConfigurationFlow(): Promise<RetrieverConfig> {
  console.log(chalk.cyan('\n━━━ Configuration Setup ━━━\n'));

  // Step 1: Select Region
  const { region } = await inquirer.prompt([
    {
      type: 'list',
      name: 'region',
      message: 'Select AWS region for deployment:',
      choices: COMMON_REGIONS
    }
  ]);

  console.log(chalk.green('✓ Region:'), chalk.white(region));

  // Step 2: List and select VPC
  const vpcSpinner = ora('Fetching VPCs...').start();
  let vpcs: VPCInfo[];

  try {
    vpcs = await listVPCs(region);
    vpcSpinner.succeed(`Found ${vpcs.length} VPC(s)`);
  } catch (error) {
    vpcSpinner.fail('Failed to fetch VPCs');
    throw error;
  }

  if (vpcs.length === 0) {
    console.error(chalk.red('\nNo VPCs found in this region.'));
    console.error(chalk.yellow('Please create a VPC first or select a different region.'));
    process.exit(1);
  }

  const { vpcId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'vpcId',
      message: 'Select VPC to deploy Retriever into:',
      choices: vpcs.map(vpc => ({
        name: `${vpc.name} (${vpc.id}) - ${vpc.cidr}${vpc.isDefault ? ' [Default]' : ''}`,
        value: vpc.id
      }))
    }
  ]);

  const selectedVpc = vpcs.find(v => v.id === vpcId);
  console.log(chalk.green('✓ VPC:'), chalk.white(`${selectedVpc?.name} (${vpcId})`));

  // Step 3: List and select subnets
  const subnetSpinner = ora('Fetching subnets...').start();
  let subnets: SubnetInfo[];

  try {
    subnets = await listSubnets(region, vpcId);
    subnetSpinner.succeed(`Found ${subnets.length} subnet(s)`);
  } catch (error) {
    subnetSpinner.fail('Failed to fetch subnets');
    throw error;
  }

  if (subnets.length < 3) {
    console.error(chalk.red('\nInsufficient subnets in this VPC.'));
    console.error(chalk.yellow('Retriever requires at least 3 subnets (2 for load balancer, 1 for backend services).'));
    process.exit(1);
  }

  console.log(chalk.cyan('\nRetriever requires:'));
  console.log(chalk.white('  • 2 public subnets (in different availability zones) for the load balancer'));
  console.log(chalk.white('  • 1 private subnet for backend services\n'));

  // Select first public subnet (show all subnets)
  const { publicSubnetId1 } = await inquirer.prompt([
    {
      type: 'list',
      name: 'publicSubnetId1',
      message: 'Select FIRST public subnet (for load balancer):',
      choices: subnets.map(subnet => ({
        name: `${subnet.name} (${subnet.id}) - ${subnet.cidr} [${subnet.availabilityZone}]`,
        value: subnet.id
      }))
    }
  ]);

  const subnet1 = subnets.find(s => s.id === publicSubnetId1);
  console.log(chalk.green('✓ Public Subnet 1:'), chalk.white(`${subnet1?.name} (${publicSubnetId1})`));

  // Select second public subnet (must be in different AZ and different from first)
  const remainingSubnetsForPublic2 = subnets.filter(
    s => s.id !== publicSubnetId1 && s.availabilityZone !== subnet1?.availabilityZone
  );

  if (remainingSubnetsForPublic2.length === 0) {
    console.error(chalk.red('\nNo subnets available in a different availability zone.'));
    console.error(chalk.yellow('Retriever requires 2 public subnets in different AZs for high availability.'));
    console.error(chalk.yellow(`Selected subnet is in ${subnet1?.availabilityZone}. Please create a subnet in a different AZ.`));
    process.exit(1);
  }

  const { publicSubnetId2 } = await inquirer.prompt([
    {
      type: 'list',
      name: 'publicSubnetId2',
      message: 'Select SECOND public subnet (must be in different AZ):',
      choices: remainingSubnetsForPublic2.map(subnet => ({
        name: `${subnet.name} (${subnet.id}) - ${subnet.cidr} [${subnet.availabilityZone}]`,
        value: subnet.id
      }))
    }
  ]);

  const subnet2 = subnets.find(s => s.id === publicSubnetId2);
  console.log(chalk.green('✓ Public Subnet 2:'), chalk.white(`${subnet2?.name} (${publicSubnetId2})`));

  // Select private subnet (can't be either of the public ones)
  const remainingSubnetsForPrivate = subnets.filter(
    s => s.id !== publicSubnetId1 && s.id !== publicSubnetId2
  );

  if (remainingSubnetsForPrivate.length === 0) {
    console.error(chalk.red('\nNo remaining subnets available for private subnet selection.'));
    console.error(chalk.yellow('Retriever requires at least 3 total subnets.'));
    process.exit(1);
  }

  const { privateSubnetId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'privateSubnetId',
      message: 'Select private subnet (for backend services):',
      choices: remainingSubnetsForPrivate.map(subnet => ({
        name: `${subnet.name} (${subnet.id}) - ${subnet.cidr} [${subnet.availabilityZone}]`,
        value: subnet.id
      }))
    }
  ]);

  const privateSubnet = subnets.find(s => s.id === privateSubnetId);
  console.log(chalk.green('✓ Private Subnet:'), chalk.white(`${privateSubnet?.name} (${privateSubnetId})`));

  const config: RetrieverConfig = {
    region,
    vpcId,
    publicSubnetId1,
    publicSubnetId2,
    privateSubnetId
  };

  return config;
}

/**
 * Saves configuration to .retriever-config.json
 *
 * Why: Persist the configuration so users don't need to re-select
 * resources on subsequent CLI runs. This file can also be committed
 * to version control for team sharing.
 */
export async function saveConfig(config: RetrieverConfig): Promise<void> {
  try {
    await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
    console.log(chalk.green('\n✓ Configuration saved to'), chalk.white('.retriever-config.json'));
  } catch (error) {
    console.error(chalk.red('Error saving configuration:'), error);
    throw error;
  }
}

/**
 * Loads configuration from .retriever-config.json if it exists
 */
export async function loadConfig(): Promise<RetrieverConfig | null> {
  try {
    const data = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
    return JSON.parse(data) as RetrieverConfig;
  } catch (error) {
    // File doesn't exist or is invalid
    return null;
  }
}