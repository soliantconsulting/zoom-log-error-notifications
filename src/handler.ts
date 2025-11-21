import { promisify } from "node:util";
import zlib from "node:zlib";
import { SecretsManager } from "@aws-sdk/client-secrets-manager";
import type { CloudWatchLogsDecodedData, CloudWatchLogsEvent } from "aws-lambda";

const gunzip = promisify(zlib.gunzip);

const zoomSecret = await (async () => {
    if (!process.env.ZOOM_SECRET_ID) {
        throw new Error("ZOOM_SECRET_ID env variable missing");
    }

    const secretsManager = new SecretsManager();
    const secret = await secretsManager.getSecretValue({
        SecretId: process.env.ZOOM_SECRET_ID,
    });

    if (!secret.SecretString) {
        throw new Error("SecretString is missing in secret");
    }

    const secretValue = JSON.parse(secret.SecretString) as unknown;

    if (
        typeof secretValue === "object" &&
        secretValue !== null &&
        "endpointUrl" in secretValue &&
        "verificationToken" in secretValue &&
        typeof secretValue.endpointUrl === "string" &&
        typeof secretValue.verificationToken === "string"
    ) {
        return secretValue as {
            endpointUrl: string;
            verificationToken: string;
        };
    }

    throw new Error("Secret must be an object with endpointUrl and verificationToken");
})();

type LogUrls = {
    logInsightsUrl: string;
    logGroupUrl: string;
};

const createLogUrls = (logGroupName: string): LogUrls => {
    if (!process.env.AWS_ACCOUNT_ID) {
        throw new Error("LOG_ACCOUNT_ID env variable missing");
    }

    if (!process.env.AWS_REGION) {
        throw new Error("AWS_REGION env variable missing");
    }

    const accountId = process.env.AWS_ACCOUNT_ID;
    const region = process.env.AWS_REGION;
    const awsAccessPortalSubdomain = process.env.AWS_ACCESS_PORTAL_SUBDOMAIN ?? "";

    const cloudwatchUrl = new URL(
        `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}`,
    );
    const logInsightsUrl = new URL(cloudwatchUrl);
    logInsightsUrl.hash = "logsV2:logs-insights";
    const logGroupUrl = new URL(cloudwatchUrl);
    logGroupUrl.hash = `logsV2:log-groups/log-group/${logGroupName}`;

    if (!awsAccessPortalSubdomain) {
        return {
            logInsightsUrl: logInsightsUrl.toString(),
            logGroupUrl: logGroupUrl.toString(),
        };
    }

    const shortcutUrl = new URL(`https://${awsAccessPortalSubdomain}.awsapps.com/start/#/console`);
    shortcutUrl.searchParams.set("account_id", accountId);

    const shortcutLogInsightsUrl = new URL(shortcutUrl);
    shortcutLogInsightsUrl.searchParams.set("destination", logInsightsUrl.toString());

    const shortcutLogGroupUrl = new URL(shortcutUrl);
    shortcutLogGroupUrl.searchParams.set("destination", logGroupUrl.toString());

    return {
        logInsightsUrl: shortcutLogInsightsUrl.toString(),
        logGroupUrl: shortcutLogGroupUrl.toString(),
    };
};

let lastReportedAt = 0;
const reportThreshold = Number.parseInt(process.env.REPORT_THRESHOLD ?? "900", 10) * 1000;

type ZoomMessage = {
    type: "message";
    text: string;
    link?: string;
};

export const main = async (event: CloudWatchLogsEvent): Promise<void> => {
    const now = Date.now();
    const data = JSON.parse(
        (await gunzip(Buffer.from(event.awslogs.data, "base64"))).toString(),
    ) as CloudWatchLogsDecodedData;

    if (
        data.messageType === "CONTROL_MESSAGE" ||
        data.logEvents.length === 0 ||
        lastReportedAt + reportThreshold >= now
    ) {
        return;
    }

    const endpointUrl = new URL(zoomSecret.endpointUrl);
    endpointUrl.searchParams.set("format", "full");

    const { logInsightsUrl, logGroupUrl } = createLogUrls(data.logGroup);

    const body: ZoomMessage[] = [
        {
            type: "message",
            text: "Log Insights",
            link: logInsightsUrl,
        },
        {
            type: "message",
            text: "Log Group",
            link: logGroupUrl,
        },
        {
            type: "message",
            text: "Log Group Name",
            link: data.logGroup,
        },
    ];

    try {
        const message = JSON.parse(data.logEvents[0].message);

        if (
            message?.error &&
            typeof message.error.name === "string" &&
            typeof message.error.message === "string"
        ) {
            body.push({
                type: "message",
                text: `${message.error.name}: ${message.error.message.substring(0, 100)}`,
            });
        }
    } catch {
        body.push({
            type: "message",
            text: data.logEvents[0].message.substring(0, 100),
        });
    }

    const response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
            Authorization: zoomSecret.verificationToken,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            head: {
                text: "Errors reported in log",
                style: {
                    bold: true,
                    color: "#eb0000",
                },
            },
            body,
        }),
    });

    if (!response.ok) {
        console.error(await response.text());
        throw new Error("Failed to call Zoom API");
    }

    lastReportedAt = now;
};
