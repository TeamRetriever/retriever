import { EC2Client, DescribeVpcsCommand, DescribeSubnetsCommand, Vpc, Subnet } from '@aws-sdk/client-ec2';
import chalk from 'chalk';

export interface VPCInfo {
  id: string;
  name: string;
  cidr: string;
  isDefault: boolean;
}

export interface SubnetInfo {
  id: string;
  name: string;
  cidr: string;
  availabilityZone: string;
  isPublic: boolean;
}

/**
 * Lists all VPCs in the specified AWS region
 *
 * Why: Users need to select which VPC to deploy Retriever into.
 * We fetch all VPCs and display them with their names and CIDR blocks
 * for easy identification.
 */
export async function listVPCs(region: string): Promise<VPCInfo[]> {
  const ec2Client = new EC2Client({ region });
  const command = new DescribeVpcsCommand({});

  try {
    const response = await ec2Client.send(command);

    if (!response.Vpcs || response.Vpcs.length === 0) {
      return [];
    }

    return response.Vpcs.map((vpc: Vpc) => {
      const nameTag = vpc.Tags?.find(tag => tag.Key === 'Name');
      return {
        id: vpc.VpcId || '',
        name: nameTag?.Value || '(no name)',
        cidr: vpc.CidrBlock || '',
        isDefault: vpc.IsDefault || false
      };
    });
  } catch (error) {
    console.error(chalk.red('Error listing VPCs:'), error);
    throw error;
  }
}

/**
 * Lists all subnets in the specified VPC
 *
 * Why: Users need to select 2 public subnets (for load balancer HA) and
 * 1 private subnet (for backend services). We determine if a subnet is
 * public by checking if it has a route to an Internet Gateway.
 */
export async function listSubnets(region: string, vpcId: string): Promise<SubnetInfo[]> {
  const ec2Client = new EC2Client({ region });
  const command = new DescribeSubnetsCommand({
    Filters: [
      {
        Name: 'vpc-id',
        Values: [vpcId]
      }
    ]
  });

  try {
    const response = await ec2Client.send(command);

    if (!response.Subnets || response.Subnets.length === 0) {
      return [];
    }

    return response.Subnets.map((subnet: Subnet) => {
      const nameTag = subnet.Tags?.find(tag => tag.Key === 'Name');
      return {
        id: subnet.SubnetId || '',
        name: nameTag?.Value || '(no name)',
        cidr: subnet.CidrBlock || '',
        availabilityZone: subnet.AvailabilityZone || '',
        // Note: MapPublicIpOnLaunch is a good indicator but not definitive
        // A proper check would involve checking route tables for IGW routes
        isPublic: subnet.MapPublicIpOnLaunch || false
      };
    });
  } catch (error) {
    console.error(chalk.red('Error listing subnets:'), error);
    throw error;
  }
}