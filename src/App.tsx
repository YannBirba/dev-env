import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HomeView } from "./views/HomeView";
import { ProjectsView } from "./views/ProjectsView";
import { ServicesView } from "./views/ServicesView";
import { ConfigView } from "./views/ConfigView";
import { DockerInstallView } from "./views/DockerInstallView";
import { Sidebar } from "../src/components/Sidebar";
import "./App.css";

enum View {
  Home,
  Projects,
  Services,
  Config,
  DockerInstall
}

interface Project {
  name: string;
  slug: string;
  services: string[];
  url: string;
  environment: Record<string, string>;
}

interface Service {
  name: string;
  image: string;
  ports: string[];
  volumes: string[];
  global: boolean;
  dependencies: string[];
  config: Record<string, string>;
}

function App() {
  const [currentView, setCurrentView] = useState<View>(View.Home);
  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isEnvironmentRunning, setIsEnvironmentRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isDockerInstalled, setIsDockerInstalled] = useState(true);

  const fetchProjects = async () => {
    try {
      const projectList = await invoke<Project[]>("list_projects");
      setProjects(projectList);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchServices = async () => {
    try {
      const serviceList = await invoke<Service[]>("list_services");
      setServices(serviceList);
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchServices();
  }, []);

  useEffect(() => {
    const checkDockerAndStart = async () => {
      try {
        // Vérifier si Docker est installé
        const dockerInstalled = await invoke<boolean>("is_docker_installed");
        setIsDockerInstalled(dockerInstalled);
        
        if (!dockerInstalled) {
          setCurrentView(View.DockerInstall);
          return;
        }
        
        // Vérifier si l'environnement est en cours d'exécution
        const isRunning = await invoke<boolean>("check_environment_status");
        setIsEnvironmentRunning(isRunning);
        
        // Si une configuration existe
        const configExists = await invoke<boolean>("check_config_exists");
        
        if (configExists) {
          if (isRunning) {
            // Redémarrer l'environnement s'il est déjà en cours d'exécution
            await invoke("stop_environment");
            await invoke("start_environment");
          } else {
            // Démarrer l'environnement s'il n'est pas en cours d'exécution
            await invoke("start_environment");
          }
          setIsEnvironmentRunning(true);
          setStatusMessage("Environnement Docker démarré avec succès");
        }
      } catch (error) {
        console.error("Error during startup:", error);
        setStatusMessage(`Erreur lors du démarrage: ${error}`);
      }
    };

    checkDockerAndStart();
    
    // Ajouter un gestionnaire pour nettoyer l'environnement à la fermeture
    const handleBeforeUnload = () => {
      // Utiliser une requête synchrone pour s'assurer que c'est exécuté avant la fermeture
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "http://localhost:1420/__stop", false);
      xhr.send();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const handleAddProject = async (name: string, environment: Record<string, string>) => {
    try {
      await invoke("add_project", { name, environment });
      await fetchProjects();
      setStatusMessage(`Project ${name} created successfully`);
    } catch (error) {
      setStatusMessage(`Error creating project: ${error}`);
    }
  };

  const handleRemoveProject = async (name: string) => {
    try {
      await invoke("remove_project", { name });
      await fetchProjects();
      setStatusMessage(`Project ${name} removed successfully`);
    } catch (error) {
      setStatusMessage(`Error removing project: ${error}`);
    }
  };

  const handleUpdateProject = async (name: string, environment: Record<string, string>) => {
    try {
      await invoke("update_project", { name, environment });
      await fetchProjects();
      setStatusMessage(`Project ${name} updated successfully`);
    } catch (error) {
      setStatusMessage(`Error updating project: ${error}`);
    }
  };

  const handleAddService = async (service: Service) => {
    try {
      await invoke("add_service", { service });
      await fetchServices();
      setStatusMessage(`Service ${service.name} added successfully`);
    } catch (error) {
      setStatusMessage(`Error adding service: ${error}`);
    }
  };

  const handleRemoveService = async (name: string) => {
    try {
      await invoke("remove_service", { name });
      await fetchServices();
      await fetchProjects(); // Recharger les projets car le service a été retiré
      
      // Régénérer et redémarrer l'environnement
      const config = await invoke<string>("generate_docker_compose");
      await invoke("save_docker_compose", { content: config });
      await invoke("start_environment");
      
      setStatusMessage(`Service ${name} supprimé avec succès`);
    } catch (error) {
      setStatusMessage(`Error removing service: ${error}`);
    }
  };

  const handleAddServiceToProject = async (projectName: string, serviceName: string) => {
    try {
      await invoke("add_service_to_project", { projectName, serviceName });
      await fetchProjects();
      setStatusMessage(`Service ${serviceName} added to project ${projectName}`);
    } catch (error) {
      setStatusMessage(`Error adding service to project: ${error}`);
    }
  };

  const handleRemoveServiceFromProject = async (projectName: string, serviceName: string) => {
    try {
      await invoke("remove_service_from_project", { projectName, serviceName });
      await fetchProjects();
      setStatusMessage(`Service ${serviceName} removed from project ${projectName}`);
    } catch (error) {
      setStatusMessage(`Error removing service from project: ${error}`);
    }
  };

  const handleStartEnvironment = async () => {
    try {
      setStatusMessage("Démarrage de l'environnement Docker...");
      await invoke<string>("start_environment");
      setIsEnvironmentRunning(true);
      setStatusMessage("Environnement Docker démarré avec succès");
    } catch (error) {
      setStatusMessage(`Erreur lors du démarrage de l'environnement: ${error}`);
    }
  };

  const handleStopEnvironment = async () => {
    try {
      setStatusMessage("Arrêt de l'environnement Docker...");
      await invoke<string>("stop_environment");
      setIsEnvironmentRunning(false);
      setStatusMessage("Environnement Docker arrêté avec succès");
    } catch (error) {
      setStatusMessage(`Erreur lors de l'arrêt de l'environnement: ${error}`);
    }
  };

  const handleGenerateConfig = async () => {
    try {
      const config = await invoke<string>("generate_docker_compose");
      setStatusMessage("Configuration Docker générée avec succès");
      return config;
    } catch (error) {
      setStatusMessage(`Erreur lors de la génération de la configuration: ${error}`);
      return null;
    }
  };

  const handleUpdateService = async (service: Service) => {
    try {
      await invoke("update_service", { service });
      await fetchServices();
      setStatusMessage(`Service ${service.name} updated successfully`);
    }
    catch (error) {
      setStatusMessage(`Error updating service: ${error}`);
    }
  };

  return (
    <div className="app-container">
      {isDockerInstalled ? (
        <>
          <Sidebar
            currentView={currentView}
            onSelectView={setCurrentView}
            isEnvironmentRunning={isEnvironmentRunning}
            onStartEnvironment={handleStartEnvironment}
            onStopEnvironment={handleStopEnvironment}
          />
          <div className="content">
            {statusMessage && (
              <div className="status-message">
                {statusMessage}
                <button onClick={() => setStatusMessage("")}>×</button>
              </div>
            )}

            {currentView === View.Home && (
              <HomeView 
                projects={projects}
                services={services}
                isEnvironmentRunning={isEnvironmentRunning}
              />
            )}

            {currentView === View.Projects && (
              <ProjectsView
                projects={projects}
                services={services}
                onAddProject={handleAddProject}
                onUpdateProject={handleUpdateProject}
                onRemoveProject={handleRemoveProject}
                onAddServiceToProject={handleAddServiceToProject}
                onRemoveServiceFromProject={handleRemoveServiceFromProject}
              />
            )}

            {currentView === View.Services && (
              <ServicesView
                onUpdateService={handleUpdateService}
                services={services}
                onAddService={handleAddService}
                onRemoveService={handleRemoveService}
              />
            )}

            {currentView === View.Config && (
              <ConfigView
                onGenerateConfig={handleGenerateConfig}
              />
            )}
          </div>
        </>
      ) : (
        <DockerInstallView />
      )}
    </div>
  );
}

export default App;
