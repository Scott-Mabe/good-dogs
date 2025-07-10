# GCP Cloud Run Deployment Guide

Deploy the Good Dogs application on Google Cloud Run using containerized serverless deployment.

## Prerequisites
- Google Cloud CLI (gcloud) installed and configured
- Docker installed
- Google Cloud project with billing enabled
- Cloud Run API enabled

## Enable Required APIs
```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

## Option 1: Direct Deployment from Source

### 1. Deploy with Cloud Build
```bash
# Set your project ID
export PROJECT_ID=your-project-id
gcloud config set project $PROJECT_ID

# Deploy directly from source (Cloud Build will handle containerization)
gcloud run deploy good-dogs \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="DD_API_KEY=your_datadog_api_key,DD_RUM_APPLICATION_ID=your_rum_app_id,DD_RUM_CLIENT_TOKEN=your_rum_client_token"
```

## Option 2: Build and Push Container Image

### 1. Build and Push to Google Container Registry
```bash
# Set project ID
export PROJECT_ID=your-project-id

# Build the image
docker build -t gcr.io/$PROJECT_ID/good-dogs:latest .

# Push to Google Container Registry
docker push gcr.io/$PROJECT_ID/good-dogs:latest
```

### 2. Deploy to Cloud Run
```bash
gcloud run deploy good-dogs \
  --image gcr.io/$PROJECT_ID/good-dogs:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars="DD_API_KEY=your_datadog_api_key,DD_RUM_APPLICATION_ID=your_rum_app_id,DD_RUM_CLIENT_TOKEN=your_rum_client_token"
```

## Option 3: Using Cloud Run YAML Configuration

### 1. Create service.yaml
```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: good-dogs
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/execution-environment: gen2
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
    spec:
      containerConcurrency: 100
      containers:
      - image: gcr.io/PROJECT_ID/good-dogs:latest
        ports:
        - containerPort: 3000
        resources:
          limits:
            cpu: 1000m
            memory: 512Mi
        env:
        - name: DD_API_KEY
          value: "your_datadog_api_key"
        - name: DD_RUM_APPLICATION_ID
          value: "your_rum_app_id"
        - name: DD_RUM_CLIENT_TOKEN
          value: "your_rum_client_token"
        - name: PORT
          value: "3000"
```

### 2. Deploy with YAML
```bash
gcloud run services replace service.yaml --region us-central1
```

## Using Google Secret Manager (Recommended)

### 1. Store Secrets
```bash
# Create secrets
echo -n "your_datadog_api_key" | gcloud secrets create dd-api-key --data-file=-
echo -n "your_rum_app_id" | gcloud secrets create dd-rum-app-id --data-file=-
echo -n "your_rum_client_token" | gcloud secrets create dd-rum-client-token --data-file=-
```

### 2. Deploy with Secret References
```bash
gcloud run deploy good-dogs \
  --image gcr.io/$PROJECT_ID/good-dogs:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --update-secrets="DD_API_KEY=dd-api-key:latest,DD_RUM_APPLICATION_ID=dd-rum-app-id:latest,DD_RUM_CLIENT_TOKEN=dd-rum-client-token:latest"
```

## Persistent Storage Considerations

Since Cloud Run is stateless, consider these options for persistent data:

### 1. Cloud Storage for Images
```bash
# Create bucket for dog images
gsutil mb gs://$PROJECT_ID-dog-images

# Copy images to bucket
gsutil cp -r public/images/* gs://$PROJECT_ID-dog-images/
```

### 2. Cloud Firestore for Vote Logging
Update server.js to use Firestore instead of local file logging:
```javascript
const { Firestore } = require('@google-cloud/firestore');
const firestore = new Firestore();

// Replace file logging with Firestore
await firestore.collection('votes').add(logEntry);
```

## Custom Domain Setup

### 1. Map Custom Domain
```bash
gcloud run domain-mappings create \
  --service good-dogs \
  --domain your-domain.com \
  --region us-central1
```

### 2. Configure DNS
Follow the DNS verification steps provided by the command output.

## Monitoring and Logging

### Cloud Logging
Logs are automatically collected and available in Google Cloud Console.

### Cloud Monitoring
Set up custom metrics and alerts:
```bash
# View logs
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=good-dogs"

# Create alert policy (example)
gcloud alpha monitoring policies create --policy-from-file=alert-policy.yaml
```

## Environment Variables Reference

Required environment variables:
- `DD_API_KEY` - Datadog API key for tracing
- `DD_RUM_APPLICATION_ID` - Datadog RUM application ID
- `DD_RUM_CLIENT_TOKEN` - Datadog RUM client token
- `PORT` - Application port (automatically set by Cloud Run)

## Performance Tuning

### Memory and CPU Settings
```bash
# For high traffic
gcloud run services update good-dogs \
  --memory 1Gi \
  --cpu 2 \
  --region us-central1

# For cost optimization
gcloud run services update good-dogs \
  --memory 256Mi \
  --cpu 0.5 \
  --region us-central1
```

### Autoscaling Configuration
```bash
gcloud run services update good-dogs \
  --min-instances 1 \
  --max-instances 20 \
  --region us-central1
```

## Cost Optimization

- Use minimum resource allocation for low-traffic applications
- Set appropriate max-instances to control costs
- Consider using Cloud Scheduler for warming instances during peak hours
- Monitor usage in Cloud Billing console

## Regional Deployment
For better performance, deploy in multiple regions:
```bash
# Deploy in Europe
gcloud run deploy good-dogs-eu \
  --image gcr.io/$PROJECT_ID/good-dogs:latest \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated

# Deploy in Asia
gcloud run deploy good-dogs-asia \
  --image gcr.io/$PROJECT_ID/good-dogs:latest \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated
```