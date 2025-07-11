variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "availability_zone" {
  description = "AWS availability zone"
  type        = string
  default     = "us-east-1a"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "CIDR block for subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "instance_name" {
  description = "Name of the EC2 instance"
  type        = string
  default     = "good-dogs-ec2"
}

variable "key_pair_name" {
  description = "Name of the AWS key pair"
  type        = string
  default     = "good-dogs-key"
}

variable "public_key" {
  description = "Public key for SSH access"
  type        = string
}

variable "volume_size" {
  description = "Size of the root volume in GB"
  type        = number
  default     = 20
}

variable "user_data" {
  description = "User data script for instance initialization"
  type        = string
  default     = ""
}

