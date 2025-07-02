# Good Dogs - Setup Instructions

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
gcloud compute instances create good-dogs-vm \
    --zone=us-central1-a \
    --machine-type=e2-medium \
    --subnet=default \
    --network-tier=PREMIUM \
    --maintenance-policy=MIGRATE \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=20GB \
    --boot-disk-type=pd-standard \
    --boot-disk-device-name=good-dogs-vm \
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
gcloud compute ssh good-dogs-vm --zone=us-central1-a

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install NGINX
sudo apt install nginx -y

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y
```

## 4. Configure PostgreSQL

```bash
# Switch to postgres user and create database
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE gooddogs;
CREATE USER gooddogsuser WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE gooddogs TO gooddogsuser;
\q

# Enable and start PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

## 5. Deploy Application

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

## 6. Configure NGINX

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

## 7. Configure Datadog Observability

### 7.1 Install Datadog Agent

```bash
# Install Datadog agent
DD_API_KEY=your_datadog_api_key DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"
```

### 7.2 Configure Datadog Agent

```bash
# Configure comprehensive Datadog monitoring
sudo tee /etc/datadog-agent/datadog.yaml > /dev/null <<EOF
api_key: your_datadog_api_key
site: datadoghq.com
hostname: good-dogs-vm
tags:
  - env:doggos
  - service:good-dogs
  - team:backend

# APM Configuration
apm_config:
  enabled: true
  env: doggos
  
# Process monitoring
process_config:
  enabled: true

# Log collection
logs_enabled: true
logs_config:
  container_collect_all: false
  
# System metrics
system_probe_config:
  enabled: true
EOF
```

### 7.3 Configure Log Collection

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

# Configure PostgreSQL logs
sudo tee /etc/datadog-agent/conf.d/postgres.d/conf.yaml > /dev/null <<EOF
init_config:

instances:
  - host: localhost
    port: 5432
    username: gooddogsuser
    password: your_secure_password
    dbname: gooddogs
    tags:
      - env:doggos

logs:
  - type: file
    path: /var/log/postgresql/postgresql-*.log
    service: postgresql
    source: postgresql
    tags:
      - env:doggos
EOF

# Set proper permissions for log directories
sudo mkdir -p /var/log/good-dogs
sudo chown $USER:adm /var/log/good-dogs
sudo chmod 755 /var/log/good-dogs

# Restart Datadog agent
sudo systemctl restart datadog-agent
```

### 7.4 Configure Application Logging

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
Environment=DD_VERSION=1.0.0
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

## 8. Set up Google Cloud Storage (Optional)

```bash
# Create storage bucket for dog images
gsutil mb gs://your-good-dogs-bucket

# Set bucket permissions (adjust as needed)
gsutil iam ch allUsers:objectViewer gs://your-good-dogs-bucket
```

## 9. Configure Datadog RUM (Real User Monitoring)

### 9.1 Create RUM Application in Datadog

1. Go to Datadog RUM → Applications
2. Click "New Application"
3. Choose "Browser" as application type
4. Name: "Good Dogs"
5. Copy the generated Application ID and Client Token

### 9.2 Add RUM to Frontend

Update `/var/www/good-dogs/public/index.html`:

```html
<!-- Add before closing </head> tag -->
<script>
  (function(h,o,u,n,d) {
     h=h[d]=h[d]||{q:[],onReady:function(c){h.q.push(c)}}
     d=o.createElement(u);d.async=1;d.src=n
     n=o.getElementsByTagName(u)[0];n.parentNode.insertBefore(d,n)
  })(window,document,'script','https://www.datadoghq-browser-agent.com/datadog-rum.js','DD_RUM')
  
  DD_RUM.onReady(function() {
    DD_RUM.init({
      clientToken: 'your_rum_client_token',
      applicationId: 'your_rum_application_id',
      site: 'datadoghq.com',
      service: 'good-dogs',
      env: 'doggos',
      version: '1.0.0',
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      trackUserInteractions: true,
      trackResources: true,
      trackLongTasks: true,
      defaultPrivacyLevel: 'mask-user-input'
    })
  })
</script>
```

### 9.3 Add Custom RUM Events

Update `/var/www/good-dogs/public/script.js` to include RUM tracking:

```javascript
// Add after DOMContentLoaded
function trackRumEvent(eventName, properties = {}) {
    if (typeof DD_RUM !== 'undefined') {
        DD_RUM.addAction(eventName, properties);
    }
}

// Update handleVote function
function handleVote(isGoodDog) {
    // Track vote events
    trackRumEvent('dog_vote', {
        vote_type: isGoodDog ? 'good' : 'bad',
        timestamp: new Date().toISOString()
    });
    
    if (!isGoodDog) {
        showPopup();
        trackRumEvent('popup_shown', {
            reason: 'bad_dog_correction'
        });
    } else {
        loadNextDog();
        trackRumEvent('next_dog_loaded', {
            trigger: 'good_vote'
        });
    }
    
    // Existing vote recording code...
}

// Track popup interactions
closePopupBtn.addEventListener('click', () => {
    trackRumEvent('popup_closed', {
        method: 'button_click'
    });
    hidePopup();
    loadNextDog();
});

// Track dog image loads
function loadNextDog() {
    const startTime = performance.now();
    dogImage.src = `/api/random-dog?t=${Date.now()}`;
    
    dogImage.onload = function() {
        const loadTime = performance.now() - startTime;
        trackRumEvent('dog_image_loaded', {
            load_time_ms: Math.round(loadTime)
        });
    };
    
    dogImage.onerror = function() {
        trackRumEvent('dog_image_error', {
            error: 'failed_to_load'
        });
    };
}
```

## 10. Environment Variables

Create `/var/www/good-dogs/.env`:

```bash
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_NAME=gooddogs
DB_USER=gooddogsuser
DB_PASSWORD=your_secure_password
DD_SERVICE=good-dogs
DD_ENV=doggos
DD_VERSION=1.0.0
DD_LOGS_INJECTION=true
GCS_BUCKET=your-good-dogs-bucket
RUM_CLIENT_TOKEN=your_rum_client_token
RUM_APPLICATION_ID=your_rum_application_id
```

## 11. Configure NGINX Status for Datadog

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

## 12. Start Services

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

## 13. Access Your Application

Get your VM's external IP:

```bash
gcloud compute instances describe good-dogs-vm --zone=us-central1-a --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

Visit `http://YOUR_EXTERNAL_IP` to access the Good Dogs application.

## 14. Datadog Monitoring Verification

### 14.1 Check Data Collection

```bash
# Check if logs are being collected
sudo tail -f /var/log/good-dogs/app.log
sudo tail -f /var/log/nginx/access.log

# Verify Datadog agent status
sudo datadog-agent status

# Test APM traces
curl http://localhost:3000/api/random-dog
curl -X POST http://localhost:3000/api/vote -H "Content-Type: application/json" -d '{"vote":"good","timestamp":"2024-01-01T00:00:00Z"}'
```

### 14.2 Datadog Dashboards to Monitor

1. **APM Dashboard**: Monitor request latency, error rates, throughput
2. **Infrastructure Dashboard**: CPU, memory, disk usage
3. **RUM Dashboard**: User sessions, page views, user interactions
4. **Logs Dashboard**: Application errors, access patterns
5. **Custom Dashboard**: Dog voting metrics, popup show rates

### 14.3 Recommended Alerts

Set up alerts in Datadog for:

- High error rate (>5% in 5 minutes)
- High response time (>2s average)
- Server down (health check failures)
- High memory usage (>80%)
- Log error patterns

## 15. Monitoring and Logs

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
3. **Database**: PostgreSQL is configured with a dedicated user
4. **Updates**: Regularly update system packages
5. **SSL**: Consider setting up SSL certificates for HTTPS

## Troubleshooting

- Check service status: `sudo systemctl status good-dogs`
- Check NGINX config: `sudo nginx -t`
- View logs: `sudo journalctl -u good-dogs -f`
- Test connectivity: `curl http://localhost:3000/health`