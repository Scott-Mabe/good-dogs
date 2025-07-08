# Good Dogs - AWS Setup Instructions

This guide walks you through setting up the Good Dogs application on Amazon Web Services (AWS) with proper security and monitoring configuration.

## Prerequisites

- AWS account
- AWS CLI installed and configured
- Domain name (optional, for production)

## 1. Create EC2 Instance

```bash
# Set your preferred region
export AWS_REGION="us-east-1"

# Create a key pair for SSH access
aws ec2 create-key-pair \
    --key-name good-dogs-key \
    --query 'KeyMaterial' \
    --output text > good-dogs-key.pem

# Set proper permissions for the key
chmod 400 good-dogs-key.pem

# Create security group
aws ec2 create-security-group \
    --group-name good-dogs-sg \
    --description "Security group for Good Dogs application"

# Get security group ID
SG_ID=$(aws ec2 describe-security-groups \
    --group-names good-dogs-sg \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

# Add inbound rules
aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0  # SSH access

aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0  # HTTP access

aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0  # HTTPS access

# Launch EC2 instance (using latest Ubuntu 24.04 LTS AMI)
aws ec2 run-instances \
    --image-id ami-0e86e20dae90b2ffa \
    --count 1 \
    --instance-type t3.micro \
    --key-name good-dogs-key \
    --security-group-ids $SG_ID \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=good-dogs-server}]'
```

## 2. Connect to EC2 Instance

```bash
# Get the public IP of your instance
INSTANCE_IP=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=good-dogs-server" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

# SSH into the instance
ssh -i good-dogs-key.pem ubuntu@$INSTANCE_IP
```

## 3. Install Dependencies on EC2

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22.x LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install NGINX
sudo apt install nginx -y

# Install AWS CLI (if not pre-installed)
sudo apt install awscli -y
```

## 4. Deploy Application

```bash
# Create application directory
sudo mkdir -p /var/www/good-dogs
sudo chown ubuntu:ubuntu /var/www/good-dogs

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
User=ubuntu
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

## 6. Configure Application Load Balancer (Optional)

```bash
# Create target group
aws elbv2 create-target-group \
    --name good-dogs-targets \
    --protocol HTTP \
    --port 80 \
    --vpc-id $(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query 'Vpcs[0].VpcId' --output text) \
    --health-check-path /health

# Get target group ARN
TG_ARN=$(aws elbv2 describe-target-groups \
    --names good-dogs-targets \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

# Get instance ID
INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=good-dogs-server" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text)

# Register instance with target group
aws elbv2 register-targets \
    --target-group-arn $TG_ARN \
    --targets Id=$INSTANCE_ID

# Create Application Load Balancer
aws elbv2 create-load-balancer \
    --name good-dogs-alb \
    --subnets $(aws ec2 describe-subnets --filters "Name=default-for-az,Values=true" --query 'Subnets[*].SubnetId' --output text) \
    --security-groups $SG_ID

# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers \
    --names good-dogs-alb \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)

# Create listener
aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=$TG_ARN
```

## 7. Setup S3 Bucket for Static Assets (Optional)

```bash
# Create S3 bucket for dog images
aws s3 mb s3://good-dogs-images-$(date +%s) --region $AWS_REGION

# Set bucket name variable
BUCKET_NAME="good-dogs-images-$(date +%s)"

# Upload dog images to S3
aws s3 cp /var/www/good-dogs/public/images/ s3://$BUCKET_NAME/images/ --recursive

# Set public read access for images
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::'$BUCKET_NAME'/images/*"
    }
  ]
}'
```

## 8. Configure Datadog Observability

### 8.1 Get Your Datadog API Key

1. **Log in to your Datadog account** at https://app.datadoghq.com
2. **Navigate to Organization Settings**:
   - Click on your profile icon in the bottom left
   - Select "Organization Settings"
3. **Access API Keys**:
   - Click on "API Keys" in the left sidebar
   - Click "New Key" to create a new API key
   - Give it a descriptive name like "Good Dogs AWS Production"
   - Copy the generated API key (keep it secure!)

### 8.2 Install Datadog Agent

```bash
# Replace 'your_datadog_api_key' with your actual API key from step 8.1
DD_API_KEY=your_datadog_api_key DD_SITE="datadoghq.com" DD_APM_INSTRUMENTATION_ENABLED=host DD_APM_INSTRUMENTATION_LIBRARIES=all bash -c "$(curl -L https://install.datadoghq.com/scripts/install_script_agent7.sh)"
```

### 8.3 Configure Datadog Agent

```bash
# Configure comprehensive Datadog monitoring
# Replace 'your_datadog_api_key' with your actual API key from step 8.1
sudo tee /etc/datadog-agent/datadog.yaml > /dev/null <<EOF
api_key: your_datadog_api_key
site: datadoghq.com
hostname: good-dogs-aws-server
tags:
  - env:doggos
  - service:good-dogs
  - team:backend
  - version:1.5.0
  - cloud:aws
  - region:$AWS_REGION

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

# AWS integration
aws:
  region: $AWS_REGION
EOF
```

### 8.4 Configure Log Collection

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
      - cloud:aws
      
  - type: journald
    path: /var/log/journal
    source: systemd
    service: good-dogs
    include_units:
      - good-dogs.service
    tags:
      - env:doggos
      - cloud:aws
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
      - cloud:aws
      
  - type: file
    path: /var/log/nginx/error.log
    service: nginx
    source: nginx
    tags:
      - env:doggos
      - cloud:aws
    log_processing_rules:
      - type: multi_line
        name: new_log_start_with_date
        pattern: \d{4}\/\d{2}\/\d{2}
EOF

# Set proper permissions for log directories
sudo mkdir -p /var/log/good-dogs
sudo chown ubuntu:adm /var/log/good-dogs
sudo chmod 755 /var/log/good-dogs

# Restart Datadog agent
sudo systemctl restart datadog-agent
```

### 8.5 Configure RUM (Real User Monitoring)

#### 8.5.1 Create RUM Application in Datadog

1. Go to Datadog RUM → Applications
2. Click "New Application"
3. Choose "Browser" as application type
4. Name: "Good Dogs AWS"
5. Copy the generated Application ID and Client Token

#### 8.5.2 Add RUM to Frontend

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
    clientToken: 'your_rum_client_token', // Replace with your RUM client token from step 8.5.1
    applicationId: 'your_rum_application_id', // Replace with your RUM application ID from step 8.5.1
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

## 9. Configure CloudWatch Monitoring

### 9.1 Install CloudWatch Agent

```bash
# Download and install CloudWatch agent (latest version)
wget https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb

# Create CloudWatch agent configuration
sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json > /dev/null <<EOF
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/good-dogs/app.log",
            "log_group_name": "/aws/ec2/good-dogs/application",
            "log_stream_name": "{instance_id}/app.log"
          },
          {
            "file_path": "/var/log/nginx/access.log",
            "log_group_name": "/aws/ec2/good-dogs/nginx",
            "log_stream_name": "{instance_id}/access.log"
          },
          {
            "file_path": "/var/log/nginx/error.log",
            "log_group_name": "/aws/ec2/good-dogs/nginx",
            "log_stream_name": "{instance_id}/error.log"
          }
        ]
      },
      "journal": {
        "log_group_name": "/aws/ec2/good-dogs/systemd",
        "log_stream_name": "{instance_id}/systemd"
      }
    }
  },
  "metrics": {
    "namespace": "AWS/EC2/GoodDogs",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          "cpu_usage_idle",
          "cpu_usage_iowait",
          "cpu_usage_user",
          "cpu_usage_system"
        ],
        "metrics_collection_interval": 60,
        "totalcpu": true
      },
      "disk": {
        "measurement": [
          "used_percent",
          "inodes_free"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "diskio": {
        "measurement": [
          "io_time"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "mem": {
        "measurement": [
          "mem_used_percent",
          "mem_available_percent"
        ],
        "metrics_collection_interval": 60
      }
    }
  }
}
EOF

# Start CloudWatch agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
    -s
```

### 9.2 Create IAM Role for CloudWatch

```bash
# Create IAM role for EC2 CloudWatch access
aws iam create-role \
    --role-name GoodDogsCloudWatchRole \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "Service": "ec2.amazonaws.com"
          },
          "Action": "sts:AssumeRole"
        }
      ]
    }'

# Attach CloudWatch agent policy
aws iam attach-role-policy \
    --role-name GoodDogsCloudWatchRole \
    --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy

# Create instance profile
aws iam create-instance-profile \
    --instance-profile-name GoodDogsCloudWatchProfile

# Add role to instance profile
aws iam add-role-to-instance-profile \
    --instance-profile-name GoodDogsCloudWatchProfile \
    --role-name GoodDogsCloudWatchRole

# Associate instance profile with EC2 instance
aws ec2 associate-iam-instance-profile \
    --instance-id $INSTANCE_ID \
    --iam-instance-profile Name=GoodDogsCloudWatchProfile
```

## 10. Configure Auto Scaling (Optional)

```bash
# Create launch template
aws ec2 create-launch-template \
    --launch-template-name good-dogs-template \
    --launch-template-data '{
      "ImageId": "ami-0e86e20dae90b2ffa",
      "InstanceType": "t3.micro",
      "KeyName": "good-dogs-key",
      "SecurityGroupIds": ["'$SG_ID'"],
      "IamInstanceProfile": {
        "Name": "GoodDogsCloudWatchProfile"
      },
      "UserData": "'$(base64 -w 0 <<< '#!/bin/bash
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
# Add your deployment script here
')'"
    }'

# Create Auto Scaling Group
aws autoscaling create-auto-scaling-group \
    --auto-scaling-group-name good-dogs-asg \
    --launch-template LaunchTemplateName=good-dogs-template,Version=1 \
    --min-size 1 \
    --max-size 3 \
    --desired-capacity 2 \
    --target-group-arns $TG_ARN \
    --availability-zones $(aws ec2 describe-availability-zones --query 'AvailabilityZones[*].ZoneName' --output text)
```

## 11. Update Application Logging

Update the systemd service to include proper logging:

```bash
# Create log directory
sudo mkdir -p /var/log/good-dogs
sudo chown ubuntu:ubuntu /var/log/good-dogs

# Update systemd service
sudo tee /etc/systemd/system/good-dogs.service > /dev/null <<EOF
[Unit]
Description=Good Dogs Node.js App
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/good-dogs
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=AWS_REGION=$AWS_REGION
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

## 12. Verify NGINX Status Endpoint

The NGINX status endpoint is already configured in the main configuration. Verify it's working:

```bash
# Test NGINX status endpoint
curl http://localhost/nginx_status

# Should return nginx status information
```

## 13. Environment Variables

Create `/var/www/good-dogs/.env`:

```bash
NODE_ENV=production
PORT=3000
AWS_REGION=$AWS_REGION
DD_SERVICE=good-dogs
DD_ENV=doggos
DD_VERSION=1.5.0
DD_LOGS_INJECTION=true
RUM_CLIENT_TOKEN=your_rum_client_token  # Replace with your RUM client token
RUM_APPLICATION_ID=your_rum_application_id  # Replace with your RUM application ID
```

## 14. Configure Route 53 (Optional)

```bash
# Create hosted zone for your domain
aws route53 create-hosted-zone \
    --name yourdomain.com \
    --caller-reference $(date +%s)

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --names good-dogs-alb \
    --query 'LoadBalancers[0].DNSName' \
    --output text)

# Create A record pointing to ALB
aws route53 change-resource-record-sets \
    --hosted-zone-id YOUR_HOSTED_ZONE_ID \
    --change-batch '{
      "Changes": [
        {
          "Action": "CREATE",
          "ResourceRecordSet": {
            "Name": "yourdomain.com",
            "Type": "A",
            "AliasTarget": {
              "DNSName": "'$ALB_DNS'",
              "EvaluateTargetHealth": false,
              "HostedZoneId": "Z35SXDOTRQ7X7K"
            }
          }
        }
      ]
    }'
```

## 15. SSL Certificate with ACM (Optional)

```bash
# Request SSL certificate
aws acm request-certificate \
    --domain-name yourdomain.com \
    --domain-name www.yourdomain.com \
    --validation-method DNS

# Add HTTPS listener to ALB (after certificate is validated)
CERT_ARN=$(aws acm list-certificates \
    --query 'CertificateSummaryList[?DomainName==`yourdomain.com`].CertificateArn' \
    --output text)

aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn=$CERT_ARN \
    --default-actions Type=forward,TargetGroupArn=$TG_ARN
```

## 16. Access Your Application

```bash
# Get ALB DNS name
aws elbv2 describe-load-balancers \
    --names good-dogs-alb \
    --query 'LoadBalancers[0].DNSName' \
    --output text
```

Visit the ALB DNS name in your browser to access the Good Dogs application.

## 17. Monitoring and Troubleshooting

```bash
# View application logs
sudo tail -f /var/log/good-dogs/app.log

# View NGINX logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Check service status
sudo systemctl status good-dogs
sudo systemctl status nginx

# Test health endpoint
curl http://localhost:3000/health

# Check vote logs
tail -f /var/www/good-dogs/votes.log

# Check Datadog agent logs
sudo tail -f /var/log/datadog/agent.log

# Verify Datadog agent is collecting data
sudo datadog-agent status

# View CloudWatch logs
aws logs describe-log-groups
aws logs get-log-events --log-group-name /aws/ec2/good-dogs/application --log-stream-name INSTANCE_ID/app.log
```

## Security Best Practices

1. **Security Groups**: Only open necessary ports
2. **IAM Roles**: Use least privilege principle
3. **VPC**: Consider using private subnets for application servers
4. **SSL/TLS**: Always use HTTPS in production
5. **Updates**: Regularly update system packages and dependencies
6. **Backups**: Set up automated backups for critical data

## Cost Optimization

1. **Instance Types**: Use appropriate instance sizes
2. **Auto Scaling**: Scale based on demand
3. **Reserved Instances**: For predictable workloads
4. **S3 Storage Classes**: Use appropriate storage classes for assets
5. **CloudWatch**: Monitor and optimize based on metrics