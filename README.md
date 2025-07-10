# good-dogs

A simple website where people can view dog photos and vote on whether they think the dogs are good or bad.

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm

### Environment Variables

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

### Installation and Running

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the application**:
   ```bash
   npm start
   ```

3. **Access the application**:
   Open your browser and navigate to `http://localhost:3000`

## Docker Setup

For Docker deployment instructions, see [DOCKER.md](DOCKER.md).

## Configuration

- `PORT`: Port number (default: 3000)
- `NODE_ENV`: Environment mode (default: development)
- `DD_API_KEY`: Datadog API key for tracing and monitoring
- `DD_RUM_APPLICATION_ID`: Datadog RUM application ID
- `DD_RUM_CLIENT_TOKEN`: Datadog RUM client token