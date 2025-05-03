import { fileURLToPath } from "node:url";
import { Duration, Stack } from "aws-cdk-lib";
import {
    Code,
    Function as LambdaFunction,
    determineLatestNodeRuntime,
} from "aws-cdk-lib/aws-lambda";
import {
    CfnQueryDefinition,
    FilterPattern,
    type ILogGroup,
    SubscriptionFilter,
} from "aws-cdk-lib/aws-logs";
import { LambdaDestination } from "aws-cdk-lib/aws-logs-destinations";
import type { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { undent } from "undent";

export type ZoomLogErrorNotificationsProps = {
    /**
     * Log group to report errors for
     */
    logGroup: ILogGroup;

    /**
     * Secret which contains credentials of your Incoming Webhook
     *
     * Must contain the two properties "endpointUrl" and "verificationToken".
     */
    zoomSecret: ISecret;

    /**
     * Subdomain of your AWS access portal to allow single sign on
     */
    awsAccessPortalSubdomain?: string;

    /**
     * Threshold before reporting new errors, defaults to 15 minutes
     */
    reportThreshold?: Duration;
};

export class ZoomLogErrorNotifications extends Construct {
    public constructor(scope: Construct, id: string, props: ZoomLogErrorNotificationsProps) {
        super(scope, id);
        const stack = Stack.of(this);

        new CfnQueryDefinition(this, "ErrorsQueryDefinition", {
            name: `${stack.stackName}/Errors`,
            logGroupNames: [props.logGroup.logGroupName],
            queryString: undent(`
                fields @timestamp, @message
                | filter level = "error" or level = "fatal"
                | sort @timestamp desc
                | limit 10000
            `),
        });

        const zoomNotificationFunction = new LambdaFunction(this, "ZoomNotificationFunction", {
            runtime: determineLatestNodeRuntime(this),
            timeout: Duration.seconds(30),
            memorySize: 512,
            handler: "index.main",
            code: Code.fromAsset(fileURLToPath(new URL("./handler", import.meta.url))),
            environment: {
                ZOOM_SECRET_ID: props.zoomSecret.secretArn,
                LOG_ACCOUNT_ID: props.logGroup.stack.account,
                LOG_REGION: props.logGroup.stack.region,
                LOG_GROUP: props.logGroup.logGroupName,
                REPORT_THRESHOLD: props.reportThreshold?.toSeconds().toString() ?? "",
                AWS_ACCESS_PORTAL_SUBDOMAIN: props.awsAccessPortalSubdomain ?? "",
            },
            allowPublicSubnet: true,
        });
        props.zoomSecret.grantRead(zoomNotificationFunction);

        new SubscriptionFilter(this, "SubscriptionFilter", {
            logGroup: props.logGroup,
            filterPattern: FilterPattern.any(
                FilterPattern.stringValue("$.level", "=", "error"),
                FilterPattern.stringValue("$.level", "=", "fatal"),
            ),
            destination: new LambdaDestination(zoomNotificationFunction),
        });
    }
}
