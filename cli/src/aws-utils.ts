import {
  EC2Client,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeRouteTablesCommand,
  Vpc,
  Subnet
} from '@aws-sdk/client-ec2';
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
 * Checks if a subnet is public by examining its route table
 *
 * Why: A subnet is considered public if its route table contains a route
 * to an Internet Gateway (igw-*). This is the definitive way to determine
 * public vs private subnets, better than checking MapPublicIpOnLaunch.
 */
async function isSubnetPublic(
  ec2Client: EC2Client,
  vpcId: string,
  subnetId: string
): Promise<boolean> {
  try {
    // Get route tables associated with this subnet or the VPC main route table
    const routeTablesResponse = await ec2Client.send(
      new DescribeRouteTablesCommand({
        Filters: [
          {
            Name: 'vpc-id',
            Values: [vpcId]
          }
        ]
      })
    );

    if (!routeTablesResponse.RouteTables) {
      return false;
    }

    // Find the route table for this specific subnet
    // If no explicit association, it uses the main route table
    let relevantRouteTable = routeTablesResponse.RouteTables.find(rt =>
      rt.Associations?.some(assoc => assoc.SubnetId === subnetId)
    );

    // If no explicit association found, use the main route table for the VPC
    if (!relevantRouteTable) {
      relevantRouteTable = routeTablesResponse.RouteTables.find(rt =>
        rt.Associations?.some(assoc => assoc.Main === true)
      );
    }

    // Check if route table has a route to an Internet Gateway
    if (relevantRouteTable?.Routes) {
      return relevantRouteTable.Routes.some(
        route => route.GatewayId?.startsWith('igw-')
      );
    }

    return false;
  } catch (error) {
    // If we can't determine, fall back to MapPublicIpOnLaunch
    return false;
  }
}

/**
 * Lists all subnets in the specified VPC with proper public/private detection
 *
 * Why: Users need to select 2 public subnets (for load balancer HA) and
 * 1 private subnet (for backend services). We determine if a subnet is
 * public by checking if its route table has a route to an Internet Gateway.
 */
export async function listSubnets(region: string, vpcId: string): Promise<SubnetInfo[]> {
  const ec2Client = new EC2Client({region});
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

    // Check each subnet's route table to determine if it's public
    const subnetsWithPublicInfo = await Promise.all(
      response.Subnets.map(async (subnet: Subnet) => {
        const nameTag = subnet.Tags?.find(tag => tag.Key === 'Name');
        const subnetId = subnet.SubnetId || '';

        // Check route table for Internet Gateway route
        const isPublic = await isSubnetPublic(ec2Client, vpcId, subnetId);

        return {
          id: subnetId,
          name: nameTag?.Value || '(no name)',
          cidr: subnet.CidrBlock || '',
          availabilityZone: subnet.AvailabilityZone || '',
          isPublic
        };
      })
    );

    // Sort: private subnets first, then public subnets
    return subnetsWithPublicInfo.sort((a, b) => {
      if (a.isPublic === b.isPublic) return 0;
      return a.isPublic ? 1 : -1; // private (false) before public (true)
    });
  } catch (error) {
    console.error(chalk.red('Error listing subnets:'), error);
    throw error;
  }
}