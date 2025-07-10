# Good Dogs - Google Cloud Platform Setup Instructions

This guide walks you through setting up the Good Dogs application on Google Cloud Platform with proper firewall configuration.

## Prerequisites

- Google Cloud Platform account
- `gcloud` CLI installed and configured
- Domain name (optional, for production)

## 1. Create Google Cloud VM Instance

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Create a VM instance
gcloud compute instances create mabe-good-dogs \
    --zone=us-central1-a \
    --machine-type=e2-medium \
    --subnet=default \
    --network-tier=PREMIUM \
    --maintenance-policy=MIGRATE \
    --image-family=ubuntu-2404-lts-amd64 \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=20GB \
    --boot-disk-type=pd-standard \
    --boot-disk-device-name=good-dogs-vm \
    --tags=http-server,https-server \
    --tags=good-dogs-server
```

## 2. Configure Firewall Rules

```bash
# Create firewall rule for HTTP traffic
gcloud compute firewall-rules create allow-good-dogs-http \
    --allow tcp:80 \
    --source-ranges 0.0.0.0/0 \
    --target-tags good-dogs-server \
    --description "Allow HTTP traffic for Good Dogs app"

# Create firewall rule for HTTPS traffic (optional)
gcloud compute firewall-rules create allow-good-dogs-https \
    --allow tcp:443 \
    --source-ranges 0.0.0.0/0 \
    --target-tags good-dogs-server \
    --description "Allow HTTPS traffic for Good Dogs app"

# Create firewall rule for SSH access
gcloud compute firewall-rules create allow-good-dogs-ssh \
    --allow tcp:22 \
    --source-ranges 0.0.0.0/0 \
    --target-tags good-dogs-server \
    --description "Allow SSH access to Good Dogs VM"
```

## 3. Connect to VM and Install Dependencies

```bash
# SSH into the VM
gcloud compute ssh mabe-good-dogs --zone=us-central1-a

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22.x LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install NGINX
sudo apt install nginx -y
```

## 4. Deploy Application

```bash
# Create application directory
sudo mkdir -p /var/www/good-dogs
sudo chown $USER:$USER /var/www/good-dogs

# Copy application files to /var/www/good-dogs
# Copy the following files from your project directory:
cp package.json /var/www/good-dogs/
cp package-lock.json /var/www/good-dogs/
cp server.js /var/www/good-dogs/
cp nginx.conf /var/www/good-dogs/

# Copy the public directory and all its contents
cp -r public/ /var/www/good-dogs/

# This includes:
# - public/index.html (main HTML file)
# - public/script.js (frontend JavaScript)
# - public/style.css (CSS styles)
# - public/images/ (directory with all dog photos: dog1.jpg through dog10.jpg)

cd /var/www/good-dogs

# Install dependencies
npm install

# Create systemd service for the app
sudo tee /etc/systemd/system/good-dogs.service > /dev/null <<EOF
[Unit]
Description=Good Dogs Node.js App
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/var/www/good-dogs
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
sudo systemctl enable good-dogs
sudo systemctl start good-dogs
```

## 5. Configure NGINX

```bash
# Create proper NGINX configuration for main config file
sudo tee /etc/nginx/nginx.conf > /dev/null <<EOF
user www-data;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name localhost;

        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
        }

        location /health {
            proxy_pass http://localhost:3000/health;
            access_log off;
        }

        location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg)\$ {
            proxy_pass http://localhost:3000;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        location /nginx_status {
            stub_status on;
            access_log off;
            allow 127.0.0.1;
            deny all;
        }

        gzip on;
        gzip_vary on;
        gzip_min_length 1024;
        gzip_proxied expired no-cache no-store private auth;
        gzip_types
            text/plain
            text/css
            text/xml
            text/javascript
            application/javascript
            application/xml+rss
            application/json;
    }
}
EOF

# Test NGINX configuration
sudo nginx -t

# Restart NGINX
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 6. Configure Datadog Observability

### 6.1 Environment Variables Setup

Before configuring Datadog, you need to set up the required environment variables. Set these on your GCP VM:

```bash
# Set Datadog environment variables
export DD_API_KEY=your_datadog_api_key
export DD_RUM_APPLICATION_ID=your_rum_application_id
export DD_RUM_CLIENT_TOKEN=your_rum_client_token

# Or create a .env file for persistent configuration
sudo tee /var/www/good-dogs/.env > /dev/null <<EOF
DD_API_KEY=your_datadog_api_key
DD_RUM_APPLICATION_ID=your_rum_application_id
DD_RUM_CLIENT_TOKEN=your_rum_client_token
EOF
```

### 6.2 Get Your Datadog API Key

1. **Log in to your Datadog account** at https://app.datadoghq.com
2. **Navigate to Organization Settings**:
   - Click on your profile icon in the bottom left
   - Select "Organization Settings"
3. **Access API Keys**:
   - Click on "API Keys" in the left sidebar
   - Click "New Key" to create a new API key
   - Give it a descriptive name like "Good Dogs GCP Production"
   - Copy the generated API key (keep it secure!)

### 6.3 Install Datadog Agent

```bash
# Use the environment variable set in step 6.1
DD_API_KEY=$DD_API_KEY DD_SITE="datadoghq.com" DD_APM_INSTRUMENTATION_ENABLED=host DD_APM_INSTRUMENTATION_LIBRARIES=all bash -c "$(curl -L https://install.datadoghq.com/scripts/install_script_agent7.sh)"
```

### 6.4 Configure Datadog Agent

```bash
# Configure comprehensive Datadog monitoring
# Uses the environment variable set in step 6.1
sudo tee /etc/datadog-agent/datadog.yaml > /dev/null <<EOF
api_key: $DD_API_KEY
site: datadoghq.com
hostname: good-dogs-vm
tags:
  - env:doggos
  - service:good-dogs
  - team:backend
  - version:1.5.0
  - cloud:gcp

# APM Configuration
apm_config:
  enabled: true
  env: doggos
  service: good-dogs
  version: 1.5.0
  
# Process monitoring
process_config:
  enabled: true

# Log collection
logs_enabled: true
logs_config:
  container_collect_all: false
  
# System metrics and Universal Service Monitoring
system_probe_config:
  enabled: true
  
# Remote Configuration
remote_configuration:
  enabled: true

# Container monitoring
container_collection:
  enabled: true

# Live processes
live_process_collection:
  enabled: true

# GCP integration
gcp:
  project_id: your-project-id
  zone: us-central1-a
EOF
```

### 6.5 Configure Log Collection

```bash
# Create logs configuration directory
sudo mkdir -p /etc/datadog-agent/conf.d/

# Configure application logs
sudo tee /etc/datadog-agent/conf.d/good-dogs.d/conf.yaml > /dev/null <<EOF
logs:
  - type: file
    path: "/var/log/good-dogs/*.log"
    service: good-dogs
    source: nodejs
    tags:
      - env:doggos
      
  - type: journald
    path: /var/log/journal
    source: systemd
    service: good-dogs
    include_units:
      - good-dogs.service
    tags:
      - env:doggos
EOF

# Configure NGINX logs
sudo tee /etc/datadog-agent/conf.d/nginx.d/conf.yaml > /dev/null <<EOF
init_config:

instances:
  - nginx_status_url: http://localhost/nginx_status

logs:
  - type: file
    path: /var/log/nginx/access.log
    service: nginx
    source: nginx
    tags:
      - env:doggos
      
  - type: file
    path: /var/log/nginx/error.log
    service: nginx
    source: nginx
    tags:
      - env:doggos
    log_processing_rules:
      - type: multi_line
        name: new_log_start_with_date
        pattern: \d{4}\/\d{2}\/\d{2}
EOF

# Set proper permissions for log directories
sudo mkdir -p /var/log/good-dogs
sudo chown $USER:adm /var/log/good-dogs
sudo chmod 755 /var/log/good-dogs

# Restart Datadog agent
sudo systemctl restart datadog-agent
```

### 6.6 Configure Application Logging

Update the systemd service to include proper logging:

```bash
sudo tee /etc/systemd/system/good-dogs.service > /dev/null <<EOF
[Unit]
Description=Good Dogs Node.js App
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/var/www/good-dogs
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DD_API_KEY=your_datadog_api_key
Environment=DD_RUM_APPLICATION_ID=your_rum_application_id
Environment=DD_RUM_CLIENT_TOKEN=your_rum_client_token
Environment=DD_SERVICE=good-dogs
Environment=DD_ENV=doggos
Environment=DD_VERSION=1.5.0
Environment=DD_LOGS_INJECTION=true
StandardOutput=append:/var/log/good-dogs/app.log
StandardError=append:/var/log/good-dogs/error.log

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and restart service
sudo systemctl daemon-reload
sudo systemctl restart good-dogs
```

### 6.7 Configure RUM (Real User Monitoring)

#### 6.7.1 Create RUM Application in Datadog

1. Go to Datadog RUM → Applications
2. Click "New Application"
3. Choose "Browser" as application type
4. Name: "Good Dogs GCP"
5. Copy the generated Application ID and Client Token (these should match your environment variables from step 6.1)

#### 6.7.2 Add RUM to Frontend

Update `/var/www/good-dogs/public/index.html` to include RUM tracking:

```html
<!-- Add before closing </head> tag -->
<script>
  (function(h,o,u,n,d) {
     h=h[d]=h[d]||{q:[],onReady:function(c){h.q.push(c)}}
     d=o.createElement(u);d.async=1;d.src=n
     n=o.getElementsByTagName(u)[0];n.parentNode.insertBefore(d,n)
  })(window,document,'script','https://www.datadoghq-browser-agent.com/us1/v5/datadog-rum.js','DD_RUM')
  
  window.DD_RUM && DD_RUM.init({
    clientToken: '$DD_RUM_CLIENT_TOKEN', // Uses environment variable from step 6.1
    applicationId: '$DD_RUM_APPLICATION_ID', // Uses environment variable from step 6.1
    site: 'datadoghq.com',
    service: 'good-dogs',
    env: 'doggos',
    version: '1.5.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    trackFrustrations: true,
    defaultPrivacyLevel: 'mask-user-input',
    allowedTracingUrls: [
      { match: window.location.origin, propagatorTypes: ['datadog'] }
    ]
  })
</script>
```

## 7. Verify NGINX Status Endpoint

The NGINX status endpoint is already configured in the main configuration. Verify it's working:

```bash
# Test NGINX status endpoint
curl http://localhost/nginx_status

# Should return nginx status information
```

## 8. Start Services

```bash
# Start all services
sudo systemctl start good-dogs
sudo systemctl start nginx
sudo systemctl start datadog-agent

# Check service status
sudo systemctl status good-dogs
sudo systemctl status nginx
sudo systemctl status datadog-agent

# Verify Datadog agent is collecting data
sudo datadog-agent status
```

## 9. Access Your Application

Get your VM's external IP:

```bash
gcloud compute instances describe mabe-good-dogs --zone=us-central1-a --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

Visit `http://YOUR_EXTERNAL_IP` to access the Good Dogs application.

## 10. Monitoring and Logs

```bash
# View application logs
sudo journalctl -u good-dogs -f

# View NGINX logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Check vote logs
tail -f /var/www/good-dogs/votes.log

# Check Datadog agent logs
sudo tail -f /var/log/datadog/agent.log
```

## Security Considerations

1. **Firewall**: Only necessary ports (80, 443, 22) are opened
2. **SSH**: Consider using SSH keys instead of passwords
3. **Updates**: Regularly update system packages
4. **SSL**: Consider setting up SSL certificates for HTTPS

## Troubleshooting

- Check service status: `sudo systemctl status good-dogs`
- Check NGINX config: `sudo nginx -t`
- View logs: `sudo journalctl -u good-dogs -f`
- Test connectivity: `curl http://localhost:3000/health`