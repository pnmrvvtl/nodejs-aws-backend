import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
} from "aws-lambda";
import { handler } from "./basicAuthorizer";

function createEvent(
  authorizationToken?: string,
): APIGatewayTokenAuthorizerEvent {
  return {
    type: "TOKEN",
    authorizationToken: authorizationToken ?? "",
    methodArn:
      "arn:aws:execute-api:eu-central-1:123456789012:api-id/prod/GET/import",
  };
}

function getStatementEffect(result: APIGatewayAuthorizerResult): string {
  const statement = result.policyDocument.Statement[0];

  if (Array.isArray(statement)) {
    throw new Error("Unexpected policy statement array");
  }

  return statement.Effect;
}

describe("basicAuthorizer", () => {
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    process.env.pnmrvvtl = "TEST_PASSWORD";
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test("returns allow policy for valid credentials", async () => {
    const token = Buffer.from("pnmrvvtl:TEST_PASSWORD").toString("base64");

    const result = await handler(createEvent(`Basic ${token}`));

    expect(result.principalId).toBe("pnmrvvtl");
    expect(getStatementEffect(result)).toBe("Allow");
  });

  test("returns deny policy for invalid password", async () => {
    const token = Buffer.from("pnmrvvtl:WRONG_PASSWORD").toString("base64");

    const result = await handler(createEvent(`Basic ${token}`));

    expect(result.principalId).toBe("pnmrvvtl");
    expect(getStatementEffect(result)).toBe("Deny");
  });

  test("returns deny policy for invalid scheme", async () => {
    const token = Buffer.from("pnmrvvtl:TEST_PASSWORD").toString("base64");

    const result = await handler(createEvent(`Bearer ${token}`));

    expect(result.principalId).toBe("anonymous");
    expect(getStatementEffect(result)).toBe("Deny");
  });

  test("throws unauthorized when token is missing", async () => {
    await expect(handler(createEvent())).rejects.toBe("Unauthorized");
  });
});
