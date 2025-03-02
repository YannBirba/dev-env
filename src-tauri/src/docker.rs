use serde_yaml::to_string as yaml_to_string;
use serde_yaml::{Mapping as YamlMap, Value as YamlValue};

use crate::AppState;

pub fn generate_docker_compose(state: &AppState) -> Result<String, String> {
    let mut compose = YamlMap::new();
    compose.insert(YamlValue::from("version"), YamlValue::from("3"));

    // Create services section
    let mut services = YamlMap::new();

    // Add Traefik as the proxy service
    let mut traefik = YamlMap::new();
    traefik.insert(YamlValue::from("image"), YamlValue::from("traefik:latest"));
    traefik.insert(YamlValue::from("restart"), YamlValue::from("always"));

    let mut traefik_ports = Vec::new();
    traefik_ports.push(YamlValue::from("80:80"));
    traefik_ports.push(YamlValue::from("443:443"));
    traefik_ports.push(YamlValue::from("8080:8080"));

    traefik.insert(YamlValue::from("ports"), YamlValue::from(traefik_ports));

    let mut traefik_volumes = Vec::new();
    traefik_volumes.push(YamlValue::from("/var/run/docker.sock:/var/run/docker.sock"));
    traefik_volumes.push(YamlValue::from("./traefik/config:/etc/traefik"));
    traefik_volumes.push(YamlValue::from("./traefik/certs:/etc/certs"));

    traefik.insert(YamlValue::from("volumes"), YamlValue::from(traefik_volumes));

    // Add network configuration to traefik
    let mut networks = Vec::new();
    networks.push(YamlValue::from("dev_env_network"));
    traefik.insert(YamlValue::from("networks"), YamlValue::from(networks.clone()));

    services.insert(YamlValue::from("traefik"), YamlValue::from(traefik));

    // Add user services
    for (name, service) in &state.services {
        let mut service_config = YamlMap::new();
        service_config.insert(
            YamlValue::from("image"),
            YamlValue::from(service.image.as_str()),
        );

        if !service.ports.is_empty() {
            let ports: Vec<YamlValue> = service
                .ports
                .iter()
                .map(|p| YamlValue::from(p.as_str()))
                .collect();
            service_config.insert(YamlValue::from("ports"), YamlValue::from(ports));
        }

        if !service.volumes.is_empty() {
            let volumes: Vec<YamlValue> = service
                .volumes
                .iter()
                .map(|v| YamlValue::from(v.as_str()))
                .collect();
            service_config.insert(YamlValue::from("volumes"), YamlValue::from(volumes));
        }

        if !service.dependencies.is_empty() {
            let depends_on: Vec<YamlValue> = service
                .dependencies
                .iter()
                .map(|d| YamlValue::from(d.as_str()))
                .collect();
            service_config.insert(YamlValue::from("depends_on"), YamlValue::from(depends_on));
        }

        if !service.config.is_empty() {
            let mut environment = YamlMap::new();
            for (key, value) in &service.config {
                environment.insert(
                    YamlValue::from(key.as_str()),
                    YamlValue::from(value.as_str()),
                );
            }
            service_config.insert(YamlValue::from("environment"), YamlValue::from(environment));
        }

        // Add network configuration to the service
        service_config.insert(YamlValue::from("networks"), YamlValue::from(networks.clone()));

        services.insert(
            YamlValue::from(name.as_str()),
            YamlValue::from(service_config),
        );
    }

    // Add project environments
    for (_, project) in &state.projects {
        // Add PHP service
        let php_service_name = format!("php_{}", project.slug);
        let mut php_service = YamlMap::new();
        php_service.insert(YamlValue::from("image"), YamlValue::from("php:8.2-fpm"));

        let mut php_volumes = Vec::new();
        php_volumes.push(YamlValue::from(format!(
            "./projects/{}:/var/www/html",
            project.slug
        )));

        php_service.insert(YamlValue::from("volumes"), YamlValue::from(php_volumes));

        // Add network configuration to PHP service
        php_service.insert(YamlValue::from("networks"), YamlValue::from(networks.clone()));

        services.insert(
            YamlValue::from(php_service_name.as_str()),
            YamlValue::from(php_service),
        );

        // Add nginx service
        let nginx_service_name = format!("nginx_{}", project.slug);
        let mut nginx_service = YamlMap::new();
        nginx_service.insert(YamlValue::from("image"), YamlValue::from("nginx:latest"));

        let mut nginx_volumes = Vec::new();
        nginx_volumes.push(YamlValue::from(format!(
            "./projects/{}:/var/www/html",
            project.slug
        )));
        nginx_volumes.push(YamlValue::from(format!(
            "./nginx/{}.conf:/etc/nginx/conf.d/default.conf",
            project.slug
        )));

        nginx_service.insert(YamlValue::from("volumes"), YamlValue::from(nginx_volumes));
        
        // Add network configuration to nginx service
        nginx_service.insert(YamlValue::from("networks"), YamlValue::from(networks.clone()));

        let mut nginx_labels = YamlMap::new();
        nginx_labels.insert(YamlValue::from("traefik.enable"), YamlValue::from("true"));
        nginx_labels.insert(
            YamlValue::from("traefik.http.routers.nginx.rule"),
            YamlValue::from(format!("Host(`{}`)", project.url.replace("https://", ""))),
        );
        nginx_labels.insert(
            YamlValue::from("traefik.http.routers.nginx.tls"),
            YamlValue::from("true"),
        );

        nginx_service.insert(YamlValue::from("labels"), YamlValue::from(nginx_labels));

        let mut nginx_depends = Vec::new();
        nginx_depends.push(YamlValue::from(php_service_name.as_str()));

        nginx_service.insert(
            YamlValue::from("depends_on"),
            YamlValue::from(nginx_depends),
        );

        services.insert(
            YamlValue::from(nginx_service_name.as_str()),
            YamlValue::from(nginx_service),
        );
    }

    compose.insert(YamlValue::from("services"), YamlValue::from(services));

    // Ajouter la configuration du réseau
    let mut networks = YamlMap::new();
    let mut dev_env_network = YamlMap::new();
    dev_env_network.insert(YamlValue::from("driver"), YamlValue::from("bridge"));
    networks.insert(YamlValue::from("dev_env_network"), YamlValue::from(dev_env_network));
    compose.insert(YamlValue::from("networks"), YamlValue::from(networks));

    // Ajouter la configuration des volumes
    let mut volumes = YamlMap::new();
    
    // Parcourir tous les services pour trouver les volumes nommés
    for (_, service) in &state.services {
        for volume in &service.volumes {
            let parts: Vec<&str> = volume.split(':').collect();
            if let Some(volume_name) = parts.first() {
                if !volume_name.starts_with('.') && !volume_name.starts_with('/') {
                    // C'est un volume nommé, on l'ajoute à la configuration
                    let volume_config = YamlMap::new();
                    volumes.insert(
                        YamlValue::from(volume_name.to_string()),
                        YamlValue::from(volume_config),
                    );
                }
            }
        }
    }

    // Ajouter les volumes à la configuration si présents
    if !volumes.is_empty() {
        compose.insert(YamlValue::from("volumes"), YamlValue::from(volumes));
    }

    // Convert to YAML
    yaml_to_string(&YamlValue::from(compose))
        .map_err(|e| format!("Failed to generate Docker Compose file: {}", e))
}

pub fn generate_traefik_config() -> Result<(), String> {
    use crate::system;
    use std::fs;

    let docker_dir = system::get_docker_compose_dir()?;
    let traefik_dir = docker_dir.join("traefik");
    let config_dir = traefik_dir.join("config");
    let certs_dir = traefik_dir.join("certs");

    // Create directories if they don't exist
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create Traefik config directory: {}", e))?;
    fs::create_dir_all(&certs_dir)
        .map_err(|e| format!("Failed to create Traefik certs directory: {}", e))?;

    // Create traefik.toml if it doesn't exist
    let traefik_config_path = config_dir.join("traefik.toml");
    if !traefik_config_path.exists() {
        let traefik_config = r#"[api]
  dashboard = true
  insecure = true

[log]
  level = "INFO"

[providers.docker]
  endpoint = "unix:///var/run/docker.sock"
  exposedByDefault = false
  network = "dev_env_network"
  watch = true

[entryPoints.web]
  address = ":80"
  [entryPoints.web.http.redirections.entryPoint]
    to = "websecure"
    scheme = "https"

[entryPoints.websecure]
  address = ":443"

# Configuration pour les certificats locaux
[tls]
  [[tls.certificates]]
    certFile = "/etc/certs/local.test.crt"
    keyFile = "/etc/certs/local.test.key"
  
  # Configuration pour les domaines en .local.test
  [[tls.domains]]
    main = "*.local.test"
    sans = ["local.test"]
"#;
        fs::write(&traefik_config_path, traefik_config)
            .map_err(|e| format!("Failed to write Traefik config: {}", e))?;
    }

    // Générer un certificat auto-signé pour *.local.test si nécessaire
    let cert_path = certs_dir.join("local.test.crt");
    let key_path = certs_dir.join("local.test.key");

    if !cert_path.exists() || !key_path.exists() {
        use std::process::Command;

        Command::new("openssl")
            .args([
                "req",
                "-x509",
                "-newkey",
                "rsa:4096",
                "-sha256",
                "-days",
                "3650",
                "-nodes",
                "-keyout",
                key_path.to_str().unwrap(),
                "-out",
                cert_path.to_str().unwrap(),
                "-subj",
                "/CN=*.local.test",
                "-addext",
                "subjectAltName=DNS:*.local.test,DNS:local.test",
            ])
            .output()
            .map_err(|e| format!("Failed to generate SSL certificate: {}", e))?;
    }

    Ok(())
}
