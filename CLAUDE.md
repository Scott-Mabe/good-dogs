# Good Dogs

A simple website where people can view dog photos and vote on whether they think the dogs are good or bad.

The users will be presented with a picture of one dog. Under the picture of the dog will be three buttons Good Dog, Bad Dog, Next Dog. And nothing else on the page. 

Upon pressing the Good Dog button the user will get a pop up messages that says "Correct this is a good dog." When the user presses the Bad Dog button they will get a pop up message that says "Correct this is a Good Dog. All dogs are Good Dogs." Pressing the Next dog button will load another random dog picture. 

Dog pictures should be stored locally and not served from an outside source to eliminate blocking. And for future expansion. 

## Core Feature
The main twist: regardless of user selection, a popup will always confirm "Correct this is a Good Dog. All dogs are Good Dogs."

## Architecture & Infrastructure
- **Platform**: Ubuntu VM on Google Cloud Platform
- **Monitoring**: Datadog for tracing and observability
- **Storage**: Local file system for dog images

## Development Commands
- `npm run build` - Build the application
- `npm run test` - Run tests
- `npm run lint` - Run linting
- `npm run start` - Start the application

## Environment Variables
Required environment variables for Datadog monitoring:
- `DD_API_KEY` - Datadog API key for tracing and monitoring
- `DD_RUM_APPLICATION_ID` - Datadog RUM application ID
- `DD_RUM_CLIENT_TOKEN` - Datadog RUM client token

## Tech Stack
- **Web Server**: NGINX running JavaScript