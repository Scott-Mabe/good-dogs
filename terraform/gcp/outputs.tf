output "instance_name" {
  description = "Name of the compute instance"
  value       = google_compute_instance.good_dogs_vm.name
}

output "instance_external_ip" {
  description = "External IP address of the compute instance"
  value       = google_compute_instance.good_dogs_vm.network_interface[0].access_config[0].nat_ip
}

output "instance_internal_ip" {
  description = "Internal IP address of the compute instance"
  value       = google_compute_instance.good_dogs_vm.network_interface[0].network_ip
}


output "ssh_connection" {
  description = "SSH connection command"
  value       = "ssh ${var.ssh_user}@${google_compute_instance.good_dogs_vm.network_interface[0].access_config[0].nat_ip}"
}