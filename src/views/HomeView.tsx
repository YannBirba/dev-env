import React from "react";

interface Project {
  name: string;
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

interface HomeViewProps {
  projects: Project[];
  services: Service[];
  isEnvironmentRunning: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  projects,
  services,
  isEnvironmentRunning
}) => {
  return (
    <div className="home-view">
      <h1>Development Environment Dashboard</h1>
      
      <div className="status-card">
        <h2>Environment Status</h2>
        <div className={`status-indicator ${isEnvironmentRunning ? "running" : "stopped"}`}>
          {isEnvironmentRunning ? "Running" : "Stopped"}
        </div>
      </div>
      
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h2>Projects</h2>
          <p>{projects.length} project(s) configured</p>
          <ul className="dashboard-list">
            {projects.map(project => (
              <li key={project.name}>
                <span className="project-name">{project.name}</span>
                <span className="project-url">{project.url}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="dashboard-card">
          <h2>Services</h2>
          <p>{services.length} service(s) configured</p>
          <ul className="dashboard-list">
            {services.map(service => (
              <li key={service.name}>
                <span className="service-name">{service.name}</span>
                <span className="service-image">{service.image}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="quick-actions">
        <h2>Getting Started</h2>
        <ol>
          <li>Create services for your development stack</li>
          <li>Set up project environments with your required services</li>
          <li>Generate and start your Docker environment</li>
          <li>Access your projects via the generated URLs</li>
        </ol>
      </div>
    </div>
  );
};
