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

## 8. Configure CloudWatch Monitoring

### 8.1 Install CloudWatch Agent

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

### 8.2 Create IAM Role for CloudWatch

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

## 9. Configure Auto Scaling (Optional)

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

## 10. Update Application Logging

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
StandardOutput=append:/var/log/good-dogs/app.log
StandardError=append:/var/log/good-dogs/error.log

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and restart service
sudo systemctl daemon-reload
sudo systemctl restart good-dogs
```

## 11. Configure Route 53 (Optional)

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

## 12. SSL Certificate with ACM (Optional)

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

## 13. Access Your Application

```bash
# Get ALB DNS name
aws elbv2 describe-load-balancers \
    --names good-dogs-alb \
    --query 'LoadBalancers[0].DNSName' \
    --output text
```

Visit the ALB DNS name in your browser to access the Good Dogs application.

## 14. Monitoring and Troubleshooting

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