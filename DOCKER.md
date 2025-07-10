# Docker Setup for Good Dogs

This guide explains how to run the Good Dogs application using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (usually included with Docker Desktop)

## Quick Start

### Option 1: Using Docker Compose (Recommended)

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd good-dogs
   ```

2. **Build and run the application**:
   ```bash
   docker-compose up --build
   ```

3. **Access the application**:
   Open your browser and navigate to `http://localhost:3000`

4. **Stop the application**:
   ```bash
   docker-compose down
   ```

### Option 2: Using Docker directly

1. **Build the Docker image**:
   ```bash
   docker build -t good-dogs .
   ```

2. **Run the container**:
   ```bash
   docker run -p 3000:3000 \
     -e DD_API_KEY=$DD_API_KEY \
     -e DD_RUM_APPLICATION_ID=$DD_RUM_APPLICATION_ID \
     -e DD_RUM_CLIENT_TOKEN=$DD_RUM_CLIENT_TOKEN \
     good-dogs
   ```

3. **Access the application**:
   Open your browser and navigate to `http://localhost:3000`

## Configuration

### Environment Variables

The application supports the following environment variables:

- `PORT`: Port number (default: 3000)
- `NODE_ENV`: Environment mode (default: production in Docker)
- `DD_API_KEY`: Datadog API key for tracing and monitoring
- `DD_RUM_APPLICATION_ID`: Datadog RUM application ID
- `DD_RUM_CLIENT_TOKEN`: Datadog RUM client token

#### Setting Datadog Environment Variables

Before running the application, set the required Datadog environment variables:

```bash
export DD_API_KEY=your_datadog_api_key
export DD_RUM_APPLICATION_ID=your_rum_application_id
export DD_RUM_CLIENT_TOKEN=your_rum_client_token
```

Or create a `.env` file in your project root:

```env
DD_API_KEY=your_datadog_api_key
DD_RUM_APPLICATION_ID=your_rum_application_id
DD_RUM_CLIENT_TOKEN=your_rum_client_token
```

### Persistent Data

The application logs votes to a file. When using Docker Compose, the `votes.log` file is mounted as a volume to persist data between container restarts.

## Health Check

The application includes a health check endpoint at `/health`. Docker Compose is configured to automatically check the application's health.

## Development

### Running in Development Mode

To run the application in development mode with live reload:

```bash
# Install dependencies locally first
npm install

# Run with nodemon for development
docker run -p 3000:3000 \
  -e DD_API_KEY=$DD_API_KEY \
  -e DD_RUM_APPLICATION_ID=$DD_RUM_APPLICATION_ID \
  -e DD_RUM_CLIENT_TOKEN=$DD_RUM_CLIENT_TOKEN \
  -v $(pwd):/usr/src/app \
  good-dogs npm run dev
```

### Building for Production

The Docker image is optimized for production with:
- Multi-stage build for smaller image size
- Non-root user for security
- Health checks for monitoring
- Proper signal handling

## Monitoring

The application includes Datadog tracing and observability features. To enable monitoring:

1. Set the appropriate Datadog environment variables
2. Ensure your Datadog agent is accessible from the container
3. Monitor logs and traces through your Datadog dashboard

## Troubleshooting

### Common Issues

1. **Port already in use**: If port 3000 is already in use, change the port mapping:
   ```bash
   docker-compose up --build -p 8080:3000
   ```

2. **Permission issues**: The application runs as a non-root user. Ensure file permissions are correct.

3. **Health check failures**: Check the application logs:
   ```bash
   docker-compose logs good-dogs
   ```

### Logs

View application logs:
```bash
# Using Docker Compose
docker-compose logs -f good-dogs

# Using Docker directly
docker logs -f <container-id>
```

## Security

The Docker setup includes several security best practices:
- Non-root user execution
- Minimal base image (Alpine Linux)
- Production-only dependencies
- Proper file permissions