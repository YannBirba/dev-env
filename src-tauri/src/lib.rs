pub mod docker;
pub mod system;

#[tauri::command]
fn add_project(
    state: tauri::State<'_, AppStateWrapper>,
    name: String,
    environment: HashMap<String, String>,
) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    let slug = system::normalize_slug(&name);
    if app_state.projects.contains_key(&slug) {
        return Err(format!("Project with name '{}' already exists", name));
    }

    // Créer le dossier du projet et fichier index.php par défaut
    system::create_project_dir(&name)?;
    // Créer la configuration Nginx pour ce projet
    system::create_nginx_config(&name)?;

    let url = generate_project_url(&slug);
    app_state.projects.insert(
        slug.clone(),
        Project {
            name,
            slug,
            services: vec![],
            url,
            environment,
        },
    );
    save_config(&app_state)?;
    Ok(())
}

#[tauri::command]
fn remove_project(state: tauri::State<'_, AppStateWrapper>, name: String) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    let slug = system::normalize_slug(&name);
    if !app_state.projects.contains_key(&slug) {
        return Err(format!("Project '{}' does not exist", name));
    }

    // Supprimer la configuration Nginx associée
    let docker_dir = system::get_docker_compose_dir()?;
    let nginx_config_path = docker_dir
        .join("nginx")
        .join(format!("{}.conf", slug));
    if nginx_config_path.exists() {
        fs::remove_file(&nginx_config_path).map_err(|e| {
            format!(
                "Failed to remove Nginx config for project '{}': {}",
                name, e
            )
        })?;
    }

    // Supprimer le dossier du projet si possible
    let project_dir = docker_dir.join("projects").join(slug.clone());
    if project_dir.exists() {
        match fs::remove_dir_all(&project_dir) {
            Ok(_) => (),
            Err(e) => {
                eprintln!(
                    "Warning: Could not remove project directory '{}': {}",
                    project_dir.display(),
                    e
                );
            }
        }
    }

    app_state.projects.remove(&slug);
    save_config(&app_state)?;
    Ok(())
}

#[tauri::command]
fn update_project(
    state: tauri::State<'_, AppStateWrapper>,
    name: String,
    environment: HashMap<String, String>,
) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    let slug = system::normalize_slug(&name);
    if !app_state.projects.contains_key(&slug) {
        return Err(format!("Project '{}' does not exist", name));
    }

    if let Some(project) = app_state.projects.get_mut(&slug) {
        project.environment = environment;
        save_config(&app_state)?;
        Ok(())
    } else {
        Err(format!("Project '{}' does not exist", name))
    }
}

#[tauri::command]
fn add_service(state: tauri::State<'_, AppStateWrapper>, service: Service) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    if app_state.services.contains_key(&service.name) {
        return Err(format!(
            "Service with name '{}' already exists",
            service.name
        ));
    }

    // Validate service dependencies
    for dependency in &service.dependencies {
        if !app_state.services.contains_key(dependency) && dependency != &service.name {
            return Err(format!("Dependency '{}' does not exist", dependency));
        }
    }

    app_state.services.insert(service.name.clone(), service);
    save_config(&app_state)?;
    Ok(())
}

#[tauri::command]
fn remove_service(state: tauri::State<'_, AppStateWrapper>, name: String) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    if !app_state.services.contains_key(&name) {
        return Err(format!("Service '{}' does not exist", name));
    }

    // Check if this service is a dependency for other services
    let dependency_for: Vec<String> = app_state
        .services
        .iter()
        .filter(|(_, service)| service.dependencies.contains(&name))
        .map(|(service_name, _)| service_name.clone())
        .collect();

    if !dependency_for.is_empty() {
        return Err(format!(
            "Service '{}' is a dependency for: {}. Remove these dependencies first.",
            name,
            dependency_for.join(", ")
        ));
    }

    // Stop and remove the container if it exists
    let down_command = format!("docker-compose stop {} && docker-compose rm -f {}", name, name);
    let output = Command::new("sh")
        .args(["-c", &down_command])
        .current_dir(system::get_docker_compose_dir()?)
        .output()
        .map_err(|e| format!("Failed to remove container: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        eprintln!("Warning while removing container: {}", error);
        // On continue même si la suppression du conteneur échoue
        // car il est possible que le conteneur n'existe pas
    }

    // Remove the service from all projects that use it
    for project in app_state.projects.values_mut() {
        project.services.retain(|s| s != &name);
    }

    // Remove the service itself
    app_state.services.remove(&name);
    save_config(&app_state)?;
    Ok(())
}

#[tauri::command]
fn update_service(
    state: tauri::State<'_, AppStateWrapper>,
    service: Service,
) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    if !app_state.services.contains_key(&service.name) {
        return Err(format!("Service '{}' does not exist", service.name));
    }

    // Validate service dependencies
    for dependency in &service.dependencies {
        if !app_state.services.contains_key(dependency) && dependency != &service.name {
            return Err(format!("Dependency '{}' does not exist", dependency));
        }
    }

    // Update the service
    app_state.services.insert(service.name.clone(), service);
    save_config(&app_state)?;
    Ok(())
}

#[tauri::command]
fn list_projects(state: tauri::State<'_, AppStateWrapper>) -> Vec<Project> {
    let app_state = state.0.lock().unwrap();
    app_state.projects.values().cloned().collect()
}

#[tauri::command]
fn list_services(state: tauri::State<'_, AppStateWrapper>) -> Vec<Service> {
    let app_state = state.0.lock().unwrap();
    app_state.services.values().cloned().collect()
}

#[tauri::command]
fn get_project_details(state: tauri::State<'_, AppStateWrapper>, name: String) -> Option<Project> {
    let app_state = state.0.lock().unwrap();
    let slug = system::normalize_slug(&name);
    app_state.projects.get(&slug).cloned()
}

#[tauri::command]
fn get_service_details(state: tauri::State<'_, AppStateWrapper>, name: String) -> Option<Service> {
    let app_state = state.0.lock().unwrap();
    app_state.services.get(&name).cloned()
}

#[tauri::command]
fn add_service_to_project(
    state: tauri::State<'_, AppStateWrapper>,
    project_name: String,
    service_name: String,
) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    let slug = system::normalize_slug(&project_name);
    if !app_state.services.contains_key(&service_name) {
        return Err(format!("Service '{}' does not exist", service_name));
    }

    if let Some(project) = app_state.projects.get_mut(&slug) {
        if !project.services.contains(&service_name) {
            project.services.push(service_name);
            save_config(&app_state)?;
        }
        Ok(())
    } else {
        Err(format!("Project '{}' does not exist", project_name))
    }
}

#[tauri::command]
fn remove_service_from_project(
    state: tauri::State<'_, AppStateWrapper>,
    project_name: String,
    service_name: String,
) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    let slug = system::normalize_slug(&project_name);
    if let Some(project) = app_state.projects.get_mut(&slug) {
        project.services.retain(|s| s != &service_name);
        save_config(&app_state)?;
        Ok(())
    } else {
        Err(format!("Project '{}' does not exist", project_name))
    }
}

#[tauri::command]
fn generate_docker_compose(state: tauri::State<'_, AppStateWrapper>) -> Result<String, String> {
    let app_state = state.0.lock().unwrap();
    docker::generate_docker_compose(&app_state)
}

#[tauri::command]
fn save_docker_compose(content: String) -> Result<(), String> {
    let docker_compose_dir = system::get_docker_compose_dir()?;
    std::fs::create_dir_all(&docker_compose_dir)
        .map_err(|e| format!("Failed to create docker-compose directory: {}", e))?;
    let docker_compose_path = docker_compose_dir.join("docker-compose.yml");
    fs::write(docker_compose_path, content)
        .map_err(|e| format!("Failed to save docker-compose.yml: {}", e))
}

#[tauri::command]
fn start_environment() -> Result<String, String> {
    let docker_compose_path = system::get_docker_compose_dir()?.join("docker-compose.yml");
    
    if !docker_compose_path.exists() {
        return Err("Docker Compose file not found. Generate configuration first.".to_string());
    }
    
    // Check if Docker is running
    if !system::is_docker_running()? {
        return Err("Docker is not running. Please start it first.".to_string());
    }
    
    let output = Command::new("docker-compose")
        .current_dir(system::get_docker_compose_dir()?)
        .args(["up", "-d"])
        .output()
        .map_err(|e| format!("Failed to start environment: {}", e))?;
        
    if output.status.success() {
        Ok("Environment started successfully".to_string())
    } else {
        let error = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Failed to start environment: {}", error))
    }
}

#[tauri::command]
fn stop_environment() -> Result<String, String> {
    let docker_compose_path = system::get_docker_compose_dir()?.join("docker-compose.yml");
    
    if !docker_compose_path.exists() {
        return Err("Docker Compose file not found. Generate configuration first.".to_string());
    }
    
    let output = Command::new("docker-compose")
        .current_dir(system::get_docker_compose_dir()?)
        .args(["down"])
        .output()
        .map_err(|e| format!("Failed to stop environment: {}", e))?;
        
    if output.status.success() {
        Ok("Environment stopped successfully".to_string())
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to stop environment: {}", error))
    }
}

#[tauri::command]
fn check_docker_status() -> Result<bool, String> {
    system::is_docker_running()
}

#[tauri::command]
fn check_environment_status() -> Result<bool, String> {
    system::is_environment_running()
}

#[tauri::command]
fn setup_hosts_file() -> Result<(), String> {
    system::setup_hosts(HTTPS_BASE_DOMAIN)
}

#[tauri::command]
fn check_hosts_entries() -> Result<Vec<(String, bool)>, String> {
    system::check_hosts_entries(HTTPS_BASE_DOMAIN)
}

#[tauri::command]
fn generate_traefik_config() -> Result<(), String> {
    docker::generate_traefik_config()
}

#[tauri::command]
fn is_docker_installed() -> Result<bool, String> {
    system::is_docker_installed()
}

#[tauri::command]
fn reset_config() -> Result<(), String> {
    let config_dir = system::get_config_dir()?;
    
    // Supprimer le dossier de configuration
    if config_dir.exists() {
        std::fs::remove_dir_all(&config_dir)
            .map_err(|e| format!("Failed to remove config directory: {}", e))?;
    }
    
    // Recréer les dossiers nécessaires
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;
        
    let docker_dir = system::get_docker_compose_dir()?;
    std::fs::create_dir_all(&docker_dir)
        .map_err(|e| format!("Failed to create docker directory: {}", e))?;
        
    Ok(())
}

#[tauri::command]
fn get_system_info() -> Result<system::SystemInfo, String> {
    system::get_system_info()
}

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::process::Command;
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Service {
    name: String,
    image: String,
    ports: Vec<String>,
    volumes: Vec<String>,
    global: bool,
    dependencies: Vec<String>,
    config: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Project {
    name: String,
    slug: String,
    services: Vec<String>,
    url: String,
    environment: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PredefinedService {
    name: String,
    image: String,
    description: String,
    port: Option<u16>,
    requires_traefik: bool,
    environment: HashMap<String, String>,
    volumes: Vec<String>,
}

impl PredefinedService {
    fn to_service(&self) -> Service {
        let mut service = Service {
            name: self.name.clone(),
            image: self.image.clone(),
            ports: Vec::new(),
            volumes: self.volumes.clone(),
            global: true,
            dependencies: Vec::new(),
            config: self.environment.clone(),
        };

        if let Some(port) = self.port {
            if self.requires_traefik {
                // Ne pas exposer le port directement, utiliser Traefik
                let domain = format!("{}.local.test", self.name.to_lowercase());
                let mut labels = HashMap::new();
                labels.insert("traefik.enable".to_string(), "true".to_string());
                labels.insert(
                    format!("traefik.http.routers.{}.rule", self.name.to_lowercase()),
                    format!("Host(`{}`)", domain),
                );
                labels.insert(
                    format!(
                        "traefik.http.services.{}.loadbalancer.server.port",
                        self.name.to_lowercase()
                    ),
                    port.to_string(),
                );
                service.config.extend(labels);
            } else {
                // Service interne, pas d'exposition de port
            }
        }

        service
    }
}

fn get_predefined_services() -> Vec<PredefinedService> {
    vec![
        PredefinedService {
            name: "mysql8".to_string(),
            image: "mysql:8".to_string(),
            description: "MySQL 8 Database Server".to_string(),
            port: Some(3306),
            requires_traefik: false,
            environment: {
                let mut env = HashMap::new();
                env.insert(
                    "MYSQL_ROOT_PASSWORD".to_string(),
                    "root_password".to_string(),
                );
                env.insert("MYSQL_DATABASE".to_string(), "dev_db".to_string());
                env.insert("MYSQL_USER".to_string(), "dev_user".to_string());
                env.insert("MYSQL_PASSWORD".to_string(), "dev_password".to_string());
                // Permettre l'accès depuis n'importe quel hôte
                env.insert("MYSQL_ROOT_HOST".to_string(), "%".to_string());
                env
            },
            volumes: vec!["mysql8_data:/var/lib/mysql".to_string()],
        },
        PredefinedService {
            name: "Redis".to_string(),
            image: "redis:latest".to_string(),
            description: "Redis Server".to_string(),
            port: Some(6379),
            requires_traefik: false,
            environment: HashMap::new(),
            volumes: vec![],
        },
        PredefinedService {
            name: "PhpMyAdmin".to_string(),
            image: "phpmyadmin/phpmyadmin".to_string(),
            description: "PhpMyAdmin Database Management".to_string(),
            port: Some(80),
            requires_traefik: true,
            environment: {
                let mut env = HashMap::new();
                env.insert("PMA_HOSTS".to_string(), "mysql8".to_string());
                env.insert(
                    "MYSQL_ROOT_PASSWORD".to_string(),
                    "root_password".to_string(),
                );
                env
            },
            volumes: vec![],
        },
        PredefinedService {
            name: "MailHog".to_string(),
            image: "mailhog/mailhog".to_string(),
            description: "SMTP Testing Server".to_string(),
            port: Some(8025),
            requires_traefik: true,
            environment: HashMap::new(),
            volumes: vec![],
        },
    ]
}

#[tauri::command]
fn list_predefined_services() -> Vec<PredefinedService> {
    get_predefined_services()
}

#[tauri::command]
fn add_predefined_service(
    state: tauri::State<'_, AppStateWrapper>,
    name: String,
) -> Result<(), String> {
    let predefined = get_predefined_services()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("Predefined service '{}' not found", name))?;

    let service = predefined.to_service();
    let mut app_state = state.0.lock().unwrap();

    // Vérifier si le service existe déjà
    if app_state.services.contains_key(&service.name) {
        return Err(format!("Service '{}' already exists", service.name));
    }

    app_state.services.insert(service.name.clone(), service);
    save_config(&app_state)?;
    Ok(())
}

#[derive(Default, Serialize, Deserialize, Clone, Debug)]
pub struct AppState {
    services: HashMap<String, Service>,
    projects: HashMap<String, Project>,
}

const CONFIG_FILE: &str = "config.json";
const HTTPS_BASE_DOMAIN: &str = "local.test";

fn save_config(state: &AppState) -> Result<(), String> {
    let json = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    // Ensure config directory exists
    let config_dir = system::get_config_dir()?;
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;

    let config_path = config_dir.join(CONFIG_FILE);
    fs::write(config_path, json).map_err(|e| format!("Failed to save config file: {}", e))
}

fn load_config() -> Result<AppState, String> {
    let config_dir = system::get_config_dir()?;
    let config_path = config_dir.join(CONFIG_FILE);

    let data = fs::read_to_string(&config_path)
        .map_err(|_| "No existing config, starting fresh".to_string())?;

    serde_json::from_str(&data).map_err(|e| format!("Failed to parse config file: {}", e))
}

fn generate_project_url(project_name: &str) -> String {
    format!("https://{}.{}", project_name, HTTPS_BASE_DOMAIN)
}

struct AppStateWrapper(Mutex<AppState>);

pub fn run() -> tauri::App {
    let app_state = load_config().unwrap_or_default();
    let state_wrapper = AppStateWrapper(Mutex::new(app_state));

    tauri::Builder::default()
        .plugin(tauri_plugin_localhost::Builder::new(1420).build())
        .manage(state_wrapper)
        .invoke_handler(tauri::generate_handler![
            add_project,
            remove_project,
            update_project,
            add_service,
            remove_service,
            update_service,
            list_projects,
            list_services,
            get_project_details,
            get_service_details,
            add_service_to_project,
            remove_service_from_project,
            generate_docker_compose,
            save_docker_compose,
            start_environment,
            stop_environment,
            check_docker_status,
            check_environment_status,
            setup_hosts_file,
            check_hosts_entries,
            generate_traefik_config,
            check_config_exists,
            list_predefined_services,
            add_predefined_service,
            reset_config,
            is_docker_installed,
            get_system_info,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
}

#[tauri::command]
fn check_config_exists() -> Result<bool, String> {
    let docker_compose_path = system::get_docker_compose_dir()?.join("docker-compose.yml");
    Ok(docker_compose_path.exists())
}
