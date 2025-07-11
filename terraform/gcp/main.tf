terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Compute Engine instance for the Good Dogs application
resource "google_compute_instance" "good_dogs_vm" {
  name         = var.instance_name
  machine_type = var.machine_type
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = var.vm_image
      size  = var.disk_size
    }
  }

  network_interface {
    network = "default"
    access_config {
      # Ephemeral public IP
    }
  }

  metadata = {
    ssh-keys = "${var.ssh_user}:${var.ssh_public_key}"
  }

  metadata_startup_script = var.startup_script

  tags = ["good-dogs", "web-server"]
}

# Firewall rule for HTTP traffic
resource "google_compute_firewall" "good_dogs_http" {
  name    = "good-dogs-allow-http"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web-server"]
}

