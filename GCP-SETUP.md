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
# Copy NGINX configuration
sudo cp nginx.conf /etc/nginx/sites-available/good-dogs

# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/good-dogs /etc/nginx/sites-enabled/

# Remove default NGINX site
sudo rm /etc/nginx/sites-enabled/default

# Test NGINX configuration
sudo nginx -t

# Restart NGINX
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 6. Configure Datadog Observability

### 6.1 Get Your Datadog API Key

1. **Log in to your Datadog account** at https://app.datadoghq.com
2. **Navigate to Organization Settings**:
   - Click on your profile icon in the bottom left
   - Select "Organization Settings"
3. **Access API Keys**:
   - Click on "API Keys" in the left sidebar
   - Click "New Key" to create a new API key
   - Give it a descriptive name like "Good Dogs GCP Production"
   - Copy the generated API key (keep it secure!)

### 6.2 Install Datadog Agent

```bash
# Replace 'your_datadog_api_key' with your actual API key from step 6.1
DD_API_KEY=your_datadog_api_key DD_SITE="datadoghq.com" DD_APM_INSTRUMENTATION_ENABLED=host DD_APM_INSTRUMENTATION_LIBRARIES=all bash -c "$(curl -L https://install.datadoghq.com/scripts/install_script_agent7.sh)"
```

### 6.3 Configure Datadog Agent

```bash
# Configure comprehensive Datadog monitoring
# Replace 'your_datadog_api_key' with your actual API key from step 6.1
sudo tee /etc/datadog-agent/datadog.yaml > /dev/null <<EOF
api_key: your_datadog_api_key
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

### 6.4 Configure Log Collection

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

### 6.5 Configure Application Logging

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

## 7. Configure NGINX Status for Datadog

Add NGINX status endpoint for monitoring:

```bash
# Update NGINX configuration to include status endpoint
sudo tee -a /etc/nginx/sites-available/good-dogs > /dev/null <<EOF

    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
EOF

# Test and reload NGINX
sudo nginx -t
sudo systemctl reload nginx
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