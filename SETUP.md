# Good Dogs - Setup Instructions

This guide walks you through setting up the Good Dogs application on a Linux server with proper configuration.

## Prerequisites

- Ubuntu/Debian Linux server
- SSH access to the server
- Domain name (optional, for production)

## 1. Install Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22.x LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install NGINX
sudo apt install nginx -y
```

## 2. Deploy Application

```bash
# Create application directory
sudo mkdir -p /var/www/good-dogs
sudo chown $USER:$USER /var/www/good-dogs

# Clone or upload your application files to /var/www/good-dogs
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

## 3. Configure NGINX

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

## 4. Configure Datadog Observability

### 4.1 Get Your Datadog API Key

1. **Log in to your Datadog account** at https://app.datadoghq.com
2. **Navigate to Organization Settings**:
   - Click on your profile icon in the bottom left
   - Select "Organization Settings"
3. **Access API Keys**:
   - Click on "API Keys" in the left sidebar
   - Click "New Key" to create a new API key
   - Give it a descriptive name like "Good Dogs Production"
   - Copy the generated API key (keep it secure!)

### 4.2 Install Datadog Agent

```bash
# Replace 'your_datadog_api_key' with your actual API key from step 4.1
DD_API_KEY=your_datadog_api_key DD_SITE="datadoghq.com" DD_APM_INSTRUMENTATION_ENABLED=host DD_APM_INSTRUMENTATION_LIBRARIES=all bash -c "$(curl -L https://install.datadoghq.com/scripts/install_script_agent7.sh)"
```

### 4.3 Configure Datadog Agent

```bash
# Configure comprehensive Datadog monitoring
# Replace 'your_datadog_api_key' with your actual API key from step 4.1
sudo tee /etc/datadog-agent/datadog.yaml > /dev/null <<EOF
api_key: your_datadog_api_key
site: datadoghq.com
hostname: good-dogs-server
tags:
  - env:doggos
  - service:good-dogs
  - team:backend
  - version:1.5.0

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
EOF
```

### 4.4 Configure Log Collection

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

### 4.5 Configure Application Logging

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

## 5. Configure Datadog RUM (Real User Monitoring)

### 5.1 Create RUM Application in Datadog

1. Go to Datadog RUM → Applications
2. Click "New Application"
3. Choose "Browser" as application type
4. Name: "Good Dogs"
5. Copy the generated Application ID and Client Token

### 5.2 Add RUM to Frontend

Update `/var/www/good-dogs/public/index.html`:

```html
<!-- Add before closing </head> tag -->
<script>
  (function(h,o,u,n,d) {
     h=h[d]=h[d]||{q:[],onReady:function(c){h.q.push(c)}}
     d=o.createElement(u);d.async=1;d.src=n
     n=o.getElementsByTagName(u)[0];n.parentNode.insertBefore(d,n)
  })(window,document,'script','https://www.datadoghq-browser-agent.com/us1/v5/datadog-rum.js','DD_RUM')
  
  window.DD_RUM && DD_RUM.init({
    clientToken: 'your_rum_client_token', // Replace with your RUM client token from step 5.1
    applicationId: 'your_rum_application_id', // Replace with your RUM application ID from step 5.1
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

## 6. Environment Variables

Create `/var/www/good-dogs/.env`:

```bash
NODE_ENV=production
PORT=3000
DD_SERVICE=good-dogs
DD_ENV=doggos
DD_VERSION=1.5.0
DD_LOGS_INJECTION=true
RUM_CLIENT_TOKEN=your_rum_client_token  # Replace with your RUM client token
RUM_APPLICATION_ID=your_rum_application_id  # Replace with your RUM application ID
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

## 9. Monitoring and Logs

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

1. **Firewall**: Configure firewall to only allow necessary ports (80, 443, 22)
2. **SSH**: Use SSH keys instead of passwords
3. **Updates**: Regularly update system packages
4. **SSL**: Set up SSL certificates for HTTPS

## Troubleshooting

- Check service status: `sudo systemctl status good-dogs`
- Check NGINX config: `sudo nginx -t`
- View logs: `sudo journalctl -u good-dogs -f`
- Test connectivity: `curl http://localhost:3000/health`