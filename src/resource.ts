import { fileURLToPath } from "node:url";
import { Duration, Names, Stack } from "aws-cdk-lib";
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
     * Log group to report errors for.
     *
     * @deprecated Use `addLogGroup` instead
     */
    logGroup?: ILogGroup;

    /**
     * Secret which contains credentials of your Incoming Webhook.
     *
     * Must contain the two properties "endpointUrl" and "verificationToken".
     */
    zoomSecret: ISecret;

    /**
     * Subdomain of your AWS access portal to allow single sign on.
     */
    awsAccessPortalSubdomain?: string;

    /**
     * Threshold before reporting new errors, defaults to 15 minutes.
     */
    reportThreshold?: Duration;

    /**
     * Name override for the query definition.
     *
     * Defaults to "<stack-name>/Errors".
     */
    queryDefinitionName?: string;
};

export class ZoomLogErrorNotifications extends Construct {
    private readonly logDestination: LambdaDestination;
    private readonly queryDefinition: CfnQueryDefinition;

    public constructor(scope: Construct, id: string, props: ZoomLogErrorNotificationsProps) {
        super(scope, id);
        const stack = Stack.of(this);

        this.queryDefinition = new CfnQueryDefinition(this, "ErrorsQueryDefinition", {
            name: props.queryDefinitionName ?? `${stack.stackName}/Errors`,
            logGroupNames: [],
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
                AWS_ACCOUNT_ID: stack.account,
                ZOOM_SECRET_ID: props.zoomSecret.secretArn,
                REPORT_THRESHOLD: props.reportThreshold?.toSeconds().toString() ?? "",
                AWS_ACCESS_PORTAL_SUBDOMAIN: props.awsAccessPortalSubdomain ?? "",
            },
            allowPublicSubnet: true,
        });
        props.zoomSecret.grantRead(zoomNotificationFunction);

        this.logDestination = new LambdaDestination(zoomNotificationFunction);

        if (props.logGroup) {
            this.addLogGroup(props.logGroup);
        }
    }

    public addLogGroup(logGroup: ILogGroup): void {
        new SubscriptionFilter(this, `SubscriptionFilter-${Names.uniqueId(logGroup)}`, {
            logGroup: logGroup,
            filterPattern: FilterPattern.any(
                FilterPattern.stringValue("$.level", "=", "error"),
                FilterPattern.stringValue("$.level", "=", "fatal"),
            ),
            destination: this.logDestination,
        });
        this.queryDefinition.logGroupNames?.push(logGroup.logGroupName);
    }
}
