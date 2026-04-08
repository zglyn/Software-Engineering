import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-2",
});

export const dynamo = DynamoDBDocumentClient.from(client);
export const USERS_TABLE = process.env.DYNAMO_TABLE_NAME || "Users";
