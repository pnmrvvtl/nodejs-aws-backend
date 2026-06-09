import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
} from "aws-lambda";

type Effect = "Allow" | "Deny";

function generatePolicy(
  principalId: string,
  effect: Effect,
  resource: string,
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}

function getEncodedCredentials(authorizationToken: string): string | null {
  const [scheme, token] = authorizationToken.split(" ");

  if (scheme !== "Basic" || !token) {
    return null;
  }

  return token;
}

function decodeCredentials(encodedCredentials: string): string | null {
  try {
    return Buffer.from(encodedCredentials, "base64").toString("utf-8");
  } catch (error: unknown) {
    console.error("Failed to decode authorization token", error);
    return null;
  }
}

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  console.log("basicAuthorizer event", {
    type: event.type,
    methodArn: event.methodArn,
  });

  if (!event.authorizationToken) {
    return Promise.reject("Unauthorized");
  }

  const encodedCredentials = getEncodedCredentials(event.authorizationToken);

  if (!encodedCredentials) {
    return generatePolicy("anonymous", "Deny", event.methodArn);
  }

  const decodedCredentials = decodeCredentials(encodedCredentials);

  if (!decodedCredentials) {
    return generatePolicy("anonymous", "Deny", event.methodArn);
  }

  const separatorIndex = decodedCredentials.indexOf(":");

  if (separatorIndex === -1) {
    return generatePolicy("anonymous", "Deny", event.methodArn);
  }

  const username = decodedCredentials.slice(0, separatorIndex);
  const password = decodedCredentials.slice(separatorIndex + 1);
  const expectedPassword = process.env[username];
  const effect = expectedPassword === password ? "Allow" : "Deny";

  return generatePolicy(username, effect, event.methodArn);
};
