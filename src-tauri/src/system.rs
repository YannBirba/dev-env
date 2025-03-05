use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;

pub fn normalize_slug(input: &str) -> String {
    // Convertir en minuscules
    let mut slug = input.to_lowercase();
    
    // Remplacer les caractères accentués
    let replacements = [
        ("é", "e"), ("è", "e"), ("ê", "e"), ("ë", "e"),
        ("à", "a"), ("â", "a"), ("ä", "a"),
        ("î", "i"), ("ï", "i"),
        ("ô", "o"), ("ö", "o"),
        ("ù", "u"), ("û", "u"), ("ü", "u"),
        ("ÿ", "y"),
        ("ç", "c"),
    ];
    
    for (from, to) in replacements.iter() {
        slug = slug.replace(from, to);
    }
    
    // Remplacer les espaces et caractères spéciaux par des tirets
    slug = slug.chars()
        .map(|c| {
            if c.is_alphanumeric() {
                c
            } else {
                '-'
            }
        })
        .collect();
    
    // Remplacer les multiples tirets par un seul
    while slug.contains("--") {
        slug = slug.replace("--", "-");
    }
    
    // Enlever les tirets au début et à la fin
    slug = slug.trim_matches('-').to_string();
    
    slug
}

// Get the application config directory
pub fn get_config_dir() -> Result<PathBuf, String> {
    let mut config_dir =
        dirs::config_dir().ok_or_else(|| "Could not determine config directory".to_string())?;
    config_dir.push("dev-env");

    // Create the directory if it doesn't exist
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir)
}

// Get the Docker Compose directory
pub fn get_docker_compose_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())?;
    let mut docker_dir = home_dir;
    docker_dir.push(".local");
    docker_dir.push("share");
    docker_dir.push("dev-env");
    docker_dir.push("docker");

    // Create the directory if it doesn't exist
    if !docker_dir.exists() {
        fs::create_dir_all(&docker_dir)
            .map_err(|e| format!("Failed to create docker directory: {}", e))?;
    }

    Ok(docker_dir)
}

// Check if Docker is running
pub fn is_docker_running() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("cmd")
            .args(["/C", "docker info"])
            .output()
            .map_err(|e| format!("Failed to check Docker status: {}", e))?;
        Ok(output.status.success())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("sh")
            .args(["-c", "docker info >/dev/null 2>&1"])
            .status()
            .map_err(|e| format!("Failed to check Docker status: {}", e))?;
        Ok(output.success())
    }
}

// Check if environment is running
pub fn is_environment_running() -> Result<bool, String> {
    let docker_compose_path = get_docker_compose_dir()?.join("docker-compose.yml");

    if !docker_compose_path.exists() {
        return Ok(false);
    }

    #[cfg(target_os = "windows")]
    {
        let output = Command::new("cmd")
            .args(["/C", "docker-compose ps -q"])
            .current_dir(get_docker_compose_dir()?)
            .output()
            .map_err(|e| format!("Failed to check environment status: {}", e))?;

        Ok(!output.stdout.is_empty())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("sh")
            .args(["-c", "docker-compose ps -q"])
            .current_dir(get_docker_compose_dir()?)
            .output()
            .map_err(|e| format!("Failed to check environment status: {}", e))?;

        Ok(!output.stdout.is_empty())
    }
}

// Setup local hosts file entries
pub fn setup_hosts(base_domain: &str) -> Result<(), String> {
    // This is a privileged operation and may require special handling
    #[cfg(target_os = "windows")]
    {
        // Path to Windows hosts file
        let hosts_path = PathBuf::from("C:\\Windows\\System32\\drivers\\etc\\hosts");
        update_hosts_file(hosts_path, base_domain)?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Path to Unix hosts file
        let hosts_path = PathBuf::from("/etc/hosts");
        update_hosts_file(hosts_path, base_domain)?;
    }

    Ok(())
}

fn update_hosts_file(hosts_path: PathBuf, base_domain: &str) -> Result<(), String> {
    // Read the current hosts file content
    let hosts_content =
        fs::read_to_string(&hosts_path).map_err(|e| format!("Failed to read hosts file: {}", e))?;

    // Entries we want to ensure are present
    let required_entries = vec![
        format!("127.0.0.1 {}", base_domain),
        format!("127.0.0.1 traefik.{}", base_domain),
        format!("127.0.0.1 pma.{}", base_domain),
        format!("127.0.0.1 mail.{}", base_domain),
    ];

    // Check if entries are already present
    let mut missing_entries = Vec::new();
    for entry in &required_entries {
        if !hosts_content.contains(entry) {
            missing_entries.push(entry.clone());
        }
    }

    if missing_entries.is_empty() {
        return Ok(());
    }

    // Inform the user about required entries
    let message = format!(
        "The following entries should be added to your hosts file ({}):
{}

This typically requires administrator/root privileges.",
        hosts_path.display(),
        missing_entries.join("\n")
    );

    // In a real app, you might want to handle this differently
    // For example, by opening an elevated process on Windows or using sudo on Unix
    eprintln!("{}", message);

    Ok(())
}

// Vérifier les entrées dans le fichier hosts
pub fn check_hosts_entries(base_domain: &str) -> Result<Vec<(String, bool)>, String> {
    #[cfg(target_os = "windows")]
    let hosts_path = std::path::PathBuf::from("C:\\Windows\\System32\\drivers\\etc\\hosts");

    #[cfg(not(target_os = "windows"))]
    let hosts_path = std::path::PathBuf::from("/etc/hosts");

    // Lire le contenu actuel du fichier hosts
    let hosts_content =
        fs::read_to_string(&hosts_path).map_err(|e| format!("Failed to read hosts file: {}", e))?;

    // Les entrées que nous voulons vérifier
    let required_entries = vec![
        format!("127.0.0.1 {}", base_domain),
        format!("127.0.0.1 traefik.{}", base_domain),
        format!("127.0.0.1 pma.{}", base_domain),
        format!("127.0.0.1 mail.{}", base_domain),
    ];

    // Vérifier quelles entrées sont présentes et lesquelles sont absentes
    let mut status: Vec<(String, bool)> = Vec::new();
    for entry in required_entries {
        let present = hosts_content.contains(&entry);
        status.push((entry, present));
    }

    Ok(status)
}

// Create a project directory
pub fn create_project_dir(project_name: &str) -> Result<PathBuf, String> {
    let normalized_name = normalize_slug(project_name);
    let mut project_dir = get_docker_compose_dir()?;
    project_dir.push("projects");
    project_dir.push(&normalized_name);

    // Create the directory if it doesn't exist
    if !project_dir.exists() {
        fs::create_dir_all(&project_dir)
            .map_err(|e| format!("Failed to create project directory: {}", e))?;

        // Create a default index.php file
        let index_path = project_dir.join("index.php");
        let mut index_file = fs::File::create(index_path)
            .map_err(|e| format!("Failed to create index.php: {}", e))?;

        writeln!(index_file, "<?php\necho '<h1>Project: {}</h1>';\necho '<p>PHP version: ' . phpversion() . '</p>';\n", project_name)
            .map_err(|e| format!("Failed to write to index.php: {}", e))?;
    }

    Ok(project_dir)
}

// Generate an NGINX configuration file for the project
pub fn create_nginx_config(project_name: &str) -> Result<PathBuf, String> {
    let normalized_name = normalize_slug(project_name);
    let mut nginx_dir = get_docker_compose_dir()?;
    nginx_dir.push("nginx");

    // Create the directory if it doesn't exist
    if !nginx_dir.exists() {
        fs::create_dir_all(&nginx_dir)
            .map_err(|e| format!("Failed to create nginx config directory: {}", e))?;
    }

    let config_path = nginx_dir.join(format!("{}.conf", &normalized_name));

    // Create a default nginx config if it doesn't exist
    if !config_path.exists() {
        let config_content = format!(
            r#"server {{
    listen 80;
    server_name localhost;
    root /var/www/html;
    index index.php index.html;

    location / {{
        try_files $uri $uri/ /index.php?$query_string;
    }}

    location ~ \.php$ {{
        fastcgi_pass php_{}:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }}
}}"#,
            &normalized_name
        );

        fs::write(&config_path, config_content)
            .map_err(|e| format!("Failed to write nginx config: {}", e))?;
    }

    Ok(config_path)
}

pub fn is_docker_installed() -> Result<bool, String> {
    let output = std::process::Command::new("sh")
        .args(["-c", "which docker"])
        .output()
        .map_err(|e| format!("Failed to check docker installation: {}", e))?;

    Ok(output.status.success())
}

pub fn restart_environment(_: &str) -> Result<(), String> {
    let docker_compose_dir = get_docker_compose_dir()?;

    // Stop the environment first
    std::process::Command::new("docker-compose")
        .args(["down"])
        .current_dir(&docker_compose_dir)
        .output()
        .map_err(|e| format!("Failed to stop environment: {}", e))?;

    // Start the environment
    std::process::Command::new("docker-compose")
        .args(["up", "-d"])
        .current_dir(&docker_compose_dir)
        .output()
        .map_err(|e| format!("Failed to start environment: {}", e))?;

    Ok(())
}
