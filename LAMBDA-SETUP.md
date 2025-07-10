# AWS Lambda Deployment Guide

Deploy the Good Dogs application on AWS Lambda using serverless architecture.

## Prerequisites
- AWS CLI installed and configured
- Node.js 18+ installed
- Serverless Framework or AWS SAM CLI

## Option 1: Using Serverless Framework

### 1. Install Serverless Framework
```bash
npm install -g serverless
npm install serverless-http
```

### 2. Create serverless.yml
```yaml
service: good-dogs-lambda

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    DD_API_KEY: ${env:DD_API_KEY}
    DD_RUM_APPLICATION_ID: ${env:DD_RUM_APPLICATION_ID}
    DD_RUM_CLIENT_TOKEN: ${env:DD_RUM_CLIENT_TOKEN}
    DD_LAMBDA_HANDLER: index.handler

functions:
  app:
    handler: lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
      - http:
          path: /
          method: ANY

plugins:
  - serverless-plugin-datadog

custom:
  datadog:
    site: datadoghq.com
    apiKey: ${env:DD_API_KEY}
```

### 3. Create Lambda Handler (lambda.js)
```javascript
const serverless = require('serverless-http');
const app = require('./server');

module.exports.handler = serverless(app);
```

### 4. Update package.json
Add to dependencies:
```json
{
  "serverless-http": "^3.2.0",
  "serverless-plugin-datadog": "^5.0.0"
}
```

### 5. Deploy
```bash
# Set environment variables
export DD_API_KEY=your_datadog_api_key
export DD_RUM_APPLICATION_ID=your_rum_app_id
export DD_RUM_CLIENT_TOKEN=your_rum_client_token

# Deploy
serverless deploy
```

## Option 2: Using AWS SAM

### 1. Install AWS SAM CLI
```bash
# macOS
brew install aws-sam-cli

# Or download from AWS
```

### 2. Create template.yaml
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Parameters:
  DatadogApiKey:
    Type: String
    NoEcho: true
  DatadogRumAppId:
    Type: String
  DatadogRumClientToken:
    Type: String
    NoEcho: true

Globals:
  Function:
    Timeout: 30
    Runtime: nodejs18.x
    Environment:
      Variables:
        DD_API_KEY: !Ref DatadogApiKey
        DD_RUM_APPLICATION_ID: !Ref DatadogRumAppId
        DD_RUM_CLIENT_TOKEN: !Ref DatadogRumClientToken

Resources:
  GoodDogsApi:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ./
      Handler: lambda.handler
      Events:
        ApiGateway:
          Type: Api
          Properties:
            Path: /{proxy+}
            Method: ANY
        RootPath:
          Type: Api
          Properties:
            Path: /
            Method: ANY

Outputs:
  ApiUrl:
    Description: "API Gateway endpoint URL"
    Value: !Sub "https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/"
```

### 3. Build and Deploy with SAM
```bash
# Build
sam build

# Deploy with guided setup (first time)
sam deploy --guided

# Or deploy with parameters
sam deploy \
  --parameter-overrides \
    DatadogApiKey=your_api_key \
    DatadogRumAppId=your_app_id \
    DatadogRumClientToken=your_client_token
```

## Important Notes

### File Storage Considerations
- Lambda has ephemeral storage limitations
- votes.log will be lost between invocations
- Consider using:
  - Amazon S3 for image storage
  - DynamoDB for vote logging
  - CloudWatch Logs for application logs

### Performance Optimization
- Enable provisioned concurrency for consistent performance
- Use Lambda layers for dependencies
- Optimize bundle size by excluding dev dependencies

### Monitoring
- CloudWatch metrics are automatically available
- Datadog Lambda extension provides enhanced monitoring
- Custom metrics can be sent to CloudWatch or Datadog

### Environment Variables
Set these in your deployment configuration:
- `DD_API_KEY` - Datadog API key
- `DD_RUM_APPLICATION_ID` - Datadog RUM application ID  
- `DD_RUM_CLIENT_TOKEN` - Datadog RUM client token

### Cost Considerations
- Lambda pricing based on requests and execution time
- API Gateway adds additional costs
- Consider Lambda@Edge for global distribution