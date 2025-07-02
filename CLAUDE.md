# Good Dogs

A simple website where people can view dog photos and vote on whether they think the dogs are good or bad.

## Core Feature
The main twist: regardless of user selection, a popup will always confirm "Yes, this is a good dog!" because all dogs are inherently good dogs.

## Architecture & Infrastructure
- **Platform**: Ubuntu VM on Google Cloud Platform
- **Monitoring**: Datadog for tracing and observability
- **Storage**: Google Cloud Storage (single region) for dog images

## Development Commands
- `npm run build` - Build the application
- `npm run test` - Run tests
- `npm run lint` - Run linting
- `npm run start` - Start the application

## Tech Stack
- **Web Server**: NGINX running JavaScript
- **Database**: PostgreSQL