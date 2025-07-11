output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.good_dogs_ec2.id
}

output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.good_dogs_ec2.public_ip
}

output "instance_private_ip" {
  description = "Private IP address of the EC2 instance"
  value       = aws_instance.good_dogs_ec2.private_ip
}


output "ssh_connection" {
  description = "SSH connection command"
  value       = "ssh -i ~/.ssh/${var.key_pair_name} ubuntu@${aws_instance.good_dogs_ec2.public_ip}"
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.good_dogs_vpc.id
}

output "subnet_id" {
  description = "Subnet ID"
  value       = aws_subnet.good_dogs_subnet.id
}

output "security_group_id" {
  description = "Security Group ID"
  value       = aws_security_group.good_dogs_sg.id
}