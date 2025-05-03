# Zoom Log Error Notifications Construct

This AWS CDK construct sends error and fatal log messages from CloudWatch Logs to a specified Zoom Incoming Webhook. It
filters the logs based on a custom query and triggers a Lambda function to send notifications to Zoom whenever an error
is logged.

## Features

- **Log Monitoring**: Watches CloudWatch Log Groups for error (`level = "error"`) and fatal (`level = "fatal"`)
  messages.
- **Zoom Integration**: Sends notifications to a Zoom Incoming Webhook when errors or fatal logs are detected.
- **Flexible Configurations**: Configure the CloudWatch Log Group, Zoom secret, and reporting threshold.

## Requirements

- **AWS CDK** v2.x or higher
- **AWS Lambda**: The construct deploys a Lambda function to send notifications to Zoom.
- **Zoom Webhook**: The construct requires a Zoom Incoming Webhook URL stored in AWS Secrets Manager.
- **NDJSON logging**: Logs in your log group must be in NDJSON format with a `level` property. 

## Installation

To install the construct, run one of the following commands in your project:

```bash
npm install @soliantconsulting/zoom-log-error-notifications
yarn add @soliantconsulting/zoom-log-error-notifications
pnpm add @soliantconsulting/zoom-log-error-notifications
```

## Usage

You can use this construct in your AWS CDK app as follows:

### 1. Define the necessary resources in your CDK stack:

```typescript
import { ZoomLogErrorNotifications } from '@soliantconsulting/zoom-log-error-notifications';
import { Duration, Stack } from 'aws-cdk-lib';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

// Create a new CloudWatch Log Group
const logGroup = new LogGroup(this, 'MyLogGroup');

// Create a new Secret to store the Zoom Webhook credentials
const zoomSecret = new Secret(this, 'ZoomWebhookSecret', {
    secretName: 'zoomWebhookSecret',
    generateSecretString: {
        secretStringTemplate: JSON.stringify({
            endpointUrl: 'https://your-zoom-webhook-url.com',
            verificationToken: 'your-zoom-token',
        }),
    },
});

// Instantiate the Zoom Log Error Notifications construct
new ZoomLogErrorNotifications(this, 'ZoomLogErrorNotifications', {
    logGroup,
    zoomSecret,
    awsAccessPortalSubdomain: 'your-portal-subdomain',
    reportThreshold: Duration.minutes(15),
});
```

### 2. Customize the environment

- **logGroup**: A CloudWatch Log Group to monitor for `error` or `fatal` log entries.
- **zoomSecret**: A secret in AWS Secrets Manager that contains the Zoom Incoming Webhook credentials. The secret should
  contain both `endpointUrl` and `verificationToken`.
- **awsAccessPortalSubdomain** (optional): The subdomain of your AWS access portal for single sign-on.
- **reportThreshold** (optional): The threshold duration to prevent sending multiple notifications for the same error (defaults to 15 minutes).

## Lambda Function Configuration

- **Runtime**: The construct uses the latest available Node.js runtime (`determineLatestNodeRuntime`).
- **Memory**: The Lambda function is allocated 512MB of memory.
- **Timeout**: The Lambda function times out after 30 seconds.

The Lambda function is bundled with the provided handler located in the `./handler` directory.

## Permissions

The Lambda function needs permissions to access the Zoom Webhook secret in Secrets Manager. The construct automatically
grants the necessary permissions by calling `grantRead()` on the provided `zoomSecret`.

## Licensing

This construct is licensed under the MIT License. See the LICENSE file for more information.
