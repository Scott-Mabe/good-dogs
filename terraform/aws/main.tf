terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Data source for latest Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# VPC and networking
resource "aws_vpc" "good_dogs_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "good-dogs-vpc"
  }
}

resource "aws_internet_gateway" "good_dogs_igw" {
  vpc_id = aws_vpc.good_dogs_vpc.id

  tags = {
    Name = "good-dogs-igw"
  }
}

resource "aws_subnet" "good_dogs_subnet" {
  vpc_id                  = aws_vpc.good_dogs_vpc.id
  cidr_block              = var.subnet_cidr
  availability_zone       = var.availability_zone
  map_public_ip_on_launch = true

  tags = {
    Name = "good-dogs-subnet"
  }
}

resource "aws_route_table" "good_dogs_rt" {
  vpc_id = aws_vpc.good_dogs_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.good_dogs_igw.id
  }

  tags = {
    Name = "good-dogs-route-table"
  }
}

resource "aws_route_table_association" "good_dogs_rta" {
  subnet_id      = aws_subnet.good_dogs_subnet.id
  route_table_id = aws_route_table.good_dogs_rt.id
}

# Security Group
resource "aws_security_group" "good_dogs_sg" {
  name        = "good-dogs-sg"
  description = "Security group for Good Dogs application"
  vpc_id      = aws_vpc.good_dogs_vpc.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "good-dogs-security-group"
  }
}

# Key Pair
resource "aws_key_pair" "good_dogs_key" {
  key_name   = var.key_pair_name
  public_key = var.public_key
}

# EC2 Instance
resource "aws_instance" "good_dogs_ec2" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.good_dogs_key.key_name
  vpc_security_group_ids = [aws_security_group.good_dogs_sg.id]
  subnet_id              = aws_subnet.good_dogs_subnet.id
  user_data              = var.user_data

  root_block_device {
    volume_type = "gp3"
    volume_size = var.volume_size
    encrypted   = true
  }

  tags = {
    Name = var.instance_name
  }
}

