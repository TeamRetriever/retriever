import {
  ACMClient,
  RequestCertificateCommand,
  DescribeCertificateCommand,
  ListCertificatesCommand,
  CertificateDetail,
  DomainValidation
} from '@aws-sdk/client-acm';
import {
  Route53Client,
  ListHostedZonesByNameCommand,
  ChangeResourceRecordSetsCommand,
  HostedZone
} from '@aws-sdk/client-route-53';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';

export interface TLSCertificate {
  certificateArn: string;
  domain: string;
}

/**
 * Finds the Route53 hosted zone for a given domain
 *
 * Why: If the domain is managed in Route53, we can automatically
 * create the DNS validation record. Otherwise, user needs to
 * manually add it to their DNS provider.
 *
 * Example: For "retriever.mycompany.com", we look for a hosted zone
 * for "mycompany.com" or "retriever.mycompany.com"
 */
async function findHostedZoneForDomain(
  route53Client: Route53Client,
  domain: string
): Promise<HostedZone | null> {
  try {
    // Try to find hosted zone by working backwards through domain parts
    // e.g., for "retriever.mycompany.com", try:
    // 1. retriever.mycompany.com
    // 2. mycompany.com
    // 3. com (won't match, but that's ok)

    const parts = domain.split('.');

    for (let i = 0; i < parts.length - 1; i++) {
      const searchDomain = parts.slice(i).join('.');

      const response = await route53Client.send(
        new ListHostedZonesByNameCommand({
          DNSName: searchDomain,
          MaxItems: 1
        })
      );

      if (response.HostedZones && response.HostedZones.length > 0) {
        const zone = response.HostedZones[0];
        // Check if zone name matches (Route53 adds a trailing dot)
        if (zone.Name === `${searchDomain}.` || zone.Name === searchDomain) {
          return zone;
        }
      }
    }

    return null;
  } catch (error) {
    console.error(chalk.yellow('Warning: Could not check Route53 hosted zones'));
    return null;
  }
}

/**
 * Creates DNS validation record in Route53
 *
 * Why: ACM requires proof of domain ownership via DNS. If the domain
 * is in Route53, we can automatically create the CNAME record that
 * ACM needs to validate the certificate.
 */
async function createRoute53ValidationRecord(
  route53Client: Route53Client,
  hostedZoneId: string,
  validation: DomainValidation
): Promise<boolean> {
  if (!validation.ResourceRecord?.Name || !validation.ResourceRecord?.Value) {
    return false;
  }

  try {
    await route53Client.send(
      new ChangeResourceRecordSetsCommand({
        HostedZoneId: hostedZoneId,
        ChangeBatch: {
          Changes: [
            {
              Action: 'UPSERT',
              ResourceRecordSet: {
                Name: validation.ResourceRecord.Name,
                Type: validation.ResourceRecord.Type,
                TTL: 300,
                ResourceRecords: [
                  {Value: validation.ResourceRecord.Value}
                ]
              }
            }
          ]
        }
      })
    );
    return true;
  } catch (error) {
    console.error(chalk.red('Error creating Route53 record:'), error);
    return false;
  }
}

/**
 * Displays manual DNS validation instructions
 *
 * Why: If domain is not in Route53, user needs to add the CNAME
 * record to their DNS provider (Cloudflare, GoDaddy, etc.)
 */
function displayManualDNSInstructions(validation: DomainValidation): void {
  console.log(chalk.cyan('\n━━━ Manual DNS Configuration Required ━━━\n'));
  console.log(chalk.white('Your domain is not managed by AWS Route53.'));
  console.log(chalk.white('Please add the following CNAME record to your DNS provider:\n'));

  console.log(chalk.yellow('Record Type:'), chalk.white('CNAME'));
  console.log(chalk.yellow('Name:'), chalk.white(validation.ResourceRecord?.Name || 'N/A'));
  console.log(chalk.yellow('Value:'), chalk.white(validation.ResourceRecord?.Value || 'N/A'));
  console.log(chalk.yellow('TTL:'), chalk.white('300 (or your provider default)\n'));
  console.log(chalk.yellow('Note that if your DNS manager has "proxy" and "DNS-only" modes, choose "DNS-Proxy".'))

  console.log(chalk.gray('This record proves you own the domain.'));
  console.log(chalk.gray('Once added, validation typically completes within minutes.\n'));
}

/**
 * Waits for ACM certificate to be validated
 *
 * Why: After DNS record is created, ACM needs time to verify it.
 * We poll the certificate status until it's validated or times out.
 */
async function waitForCertificateValidation(
  acmClient: ACMClient,
  certificateArn: string,
  maxWaitMinutes: number = 10
): Promise<boolean> {
  const maxAttempts = maxWaitMinutes * 4; // Check every 15 seconds
  const spinner = ora('Waiting for certificate validation...').start();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await acmClient.send(
        new DescribeCertificateCommand({
          CertificateArn: certificateArn
        })
      );

      const status = response.Certificate?.Status;

      if (status === 'ISSUED') {
        spinner.succeed('Certificate validated and issued!');
        return true;
      }

      if (status === 'FAILED' || status === 'VALIDATION_TIMED_OUT') {
        spinner.fail(`Certificate validation failed: ${status}`);
        return false;
      }

      // Update spinner with elapsed time
      const elapsedMinutes = Math.floor((attempt * 15) / 60);
      spinner.text = `Waiting for certificate validation... (${elapsedMinutes}m elapsed)`;

      // Wait 15 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 15000));
    } catch (error) {
      spinner.fail('Error checking certificate status');
      console.error(error);
      return false;
    }
  }

  spinner.fail(`Certificate validation timed out after ${maxWaitMinutes} minutes`);
  return false;
}

/**
 * Finds an existing ACM certificate for the given domain
 *
 * Why: Before requesting a new certificate, we should check if one
 * already exists for this domain. This prevents duplicate certificates
 * if the user runs `retriever init` multiple times.
 *
 * We only return certificates that are ISSUED or PENDING_VALIDATION
 * (not expired, revoked, or failed).
 */
async function findExistingCertificate(
  acmClient: ACMClient,
  domain: string
): Promise<string | null> {
  try {
    const response = await acmClient.send(
      new ListCertificatesCommand({
        CertificateStatuses: ['ISSUED', 'PENDING_VALIDATION']
      })
    );

    if (!response.CertificateSummaryList) {
      return null;
    }

    // Find a certificate that matches our domain
    const matchingCert = response.CertificateSummaryList.find(
      cert => cert.DomainName === domain
    );

    return matchingCert?.CertificateArn || null;
  } catch (error) {
    console.error(chalk.yellow('Warning: Could not check for existing certificates'));
    return null;
  }
}

/**
 * Requests and validates an ACM certificate for the given domain
 *
 * Flow:
 * 1. Request certificate from ACM
 * 2. Get DNS validation records from ACM
 * 3. Check if domain is in Route53
 *    - If yes: Automatically create validation record
 *    - If no: Display manual instructions
 * 4. Wait for ACM to validate the certificate
 * 5. Return certificate ARN
 *
 * Why ACM over self-signed:
 * - Free TLS certificates
 * - Automatic renewal
 * - Trusted by browsers (no warnings)
 * - Integrated with AWS services
 */
export async function requestACMCertificate(
  region: string,
  domain: string
): Promise<string | null> {
  const acmClient = new ACMClient({region});
  const route53Client = new Route53Client({region: 'us-east-1'}); // Route53 is global

  console.log(chalk.cyan(`\nRequesting TLS certificate for: ${chalk.white(domain)}`));

  // Step 1: Request certificate from ACM
  const requestSpinner = ora('Requesting certificate from AWS Certificate Manager...').start();

  let certificateArn: string;
  try {
    const response = await acmClient.send(
      new RequestCertificateCommand({
        DomainName: domain,
        ValidationMethod: 'DNS',
        Tags: [
          {
            Key: 'ManagedBy',
            Value: 'Retriever-CLI'
          }
        ]
      })
    );

    if (!response.CertificateArn) {
      requestSpinner.fail('Failed to request certificate');
      return null;
    }

    certificateArn = response.CertificateArn;
    requestSpinner.succeed('Certificate requested from ACM');
  } catch (error) {
    requestSpinner.fail('Failed to request certificate');
    console.error(error);
    return null;
  }

  // Step 2: Get validation records
  const validationSpinner = ora('Fetching DNS validation records...').start();

  let certificate: CertificateDetail | undefined;
  let validation: DomainValidation | undefined;

  // ACM takes a moment to generate validation records, so we retry a few times
  for (let i = 0; i < 10; i++) {
    const response = await acmClient.send(
      new DescribeCertificateCommand({
        CertificateArn: certificateArn
      })
    );

    certificate = response.Certificate;
    validation = certificate?.DomainValidationOptions?.[0];

    if (validation?.ResourceRecord?.Name && validation?.ResourceRecord?.Value) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  if (!validation?.ResourceRecord?.Name || !validation?.ResourceRecord?.Value) {
    validationSpinner.fail('Failed to get DNS validation records');
    return null;
  }

  validationSpinner.succeed('DNS validation records ready');

  // Step 3: Check if domain is in Route53 and handle validation
  const hostedZone = await findHostedZoneForDomain(route53Client, domain);

  if (hostedZone && hostedZone.Id) {
    console.log(chalk.green(`✓ Found Route53 hosted zone: ${hostedZone.Name}`));

    const createRecordSpinner = ora('Creating DNS validation record in Route53...').start();
    const success = await createRoute53ValidationRecord(
      route53Client,
      hostedZone.Id,
      validation
    );

    if (success) {
      createRecordSpinner.succeed('DNS validation record created automatically');
    } else {
      createRecordSpinner.fail('Failed to create DNS record automatically');
      displayManualDNSInstructions(validation);
    }
  } else {
    console.log(chalk.yellow('✗ Domain not found in Route53'));
    displayManualDNSInstructions(validation);

    const {proceed} = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Have you added the DNS record? Ready to wait for validation?',
        default: false
      }
    ]);

    if (!proceed) {
      console.log(chalk.yellow('\nCertificate request initiated but not validated.'));
      console.log(chalk.yellow('You can complete validation later and use this ARN:'));
      console.log(chalk.white(certificateArn));
      return null;
    }
  }

  // Step 4: Wait for validation
  const validated = await waitForCertificateValidation(acmClient, certificateArn);

  if (!validated) {
    console.log(chalk.yellow('\nCertificate validation incomplete.'));
    console.log(chalk.yellow('Certificate ARN (you can use this once validated):'));
    console.log(chalk.white(certificateArn));
    return null;
  }

  console.log(chalk.green('\n✓ Certificate ARN:'), chalk.white(certificateArn));
  return certificateArn;
}

/**
 * Interactive flow for TLS certificate setup using AWS Certificate Manager
 */
export async function runTLSCertificateFlow(region: string): Promise<TLSCertificate | null> {
  console.log(chalk.cyan('\n━━━ TLS Certificate Setup ━━━\n'));

  console.log(chalk.white('Retriever uses AWS Certificate Manager (ACM) for TLS certificates.'));
  console.log(chalk.white('If you already have a certificate for your domain in ACM, we\'ll use it.'));
  console.log(chalk.white('Otherwise, we\'ll request a new one and help you validate it.\n'));
  console.log(chalk.gray('Note: If your domain is managed in Route 53, validation happens automatically.'));
  console.log(chalk.gray('      If not, you\'ll need to add a DNS record to your provider.\n'));

  const {domain} = await inquirer.prompt([
    {
      type: 'input',
      name: 'domain',
      message: 'Enter your domain name for Retriever:',
      validate: (input: string) => {
        if (input.trim().length === 0) {
          return 'Domain name is required';
        }
        // Basic domain validation
        if (!/^[a-zA-Z0-9][a-zA-Z0-9-_.]+[a-zA-Z0-9]$/.test(input)) {
          return 'Invalid domain name format';
        }
        return true;
      }
    }
  ]);

  const trimmedDomain = domain.trim();
  const acmClient = new ACMClient({region});

  // Check for existing certificate first
  const existingSpinner = ora('Checking for existing certificate...').start();
  const existingCertArn = await findExistingCertificate(acmClient, trimmedDomain);

  if (existingCertArn) {
    existingSpinner.succeed('Found existing certificate!');
    console.log(chalk.green('✓ Using existing ACM certificate:'), chalk.white(existingCertArn));

    const {useExisting} = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useExisting',
        message: 'Use this existing certificate?',
        default: true
      }
    ]);

    if (useExisting) {
      return {
        certificateArn: existingCertArn,
        domain: trimmedDomain
      };
    }

    console.log(chalk.yellow('\nRequesting a new certificate instead...\n'));
  } else {
    existingSpinner.info('No existing certificate found for this domain');
  }

  // Request a new certificate
  const certificateArn = await requestACMCertificate(region, trimmedDomain);

  if (!certificateArn) {
    console.log(chalk.red('\nFailed to obtain validated certificate.'));
    console.log(chalk.yellow('Please ensure DNS records are correct and try again.'));
    return null;
  }

  return {
    certificateArn,
    domain: trimmedDomain
  };
}