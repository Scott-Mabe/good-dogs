variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "The GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "instance_name" {
  description = "Name of the compute instance"
  type        = string
  default     = "good-dogs-vm"
}

variable "machine_type" {
  description = "Machine type for the compute instance"
  type        = string
  default     = "e2-micro"
}

variable "vm_image" {
  description = "The VM image to use"
  type        = string
  default     = "ubuntu-os-cloud/ubuntu-2204-lts"
}

variable "disk_size" {
  description = "Boot disk size in GB"
  type        = number
  default     = 20
}

variable "ssh_user" {
  description = "SSH username"
  type        = string
  default     = "ubuntu"
}

variable "ssh_public_key" {
  description = "SSH public key for accessing the instance"
  type        = string
}

variable "startup_script" {
  description = "Startup script for the instance"
  type        = string
  default     = ""
}

