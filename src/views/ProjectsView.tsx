import React, { useState } from "react";

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

interface ProjectsViewProps {
  projects: Project[];
  services: Service[];
  onAddProject: (name: string, environment: Record<string, string>) => void;
  onUpdateProject: (name: string, environment: Record<string, string>) => void;
  onRemoveProject: (name: string) => void;
  onAddServiceToProject: (projectName: string, serviceName: string) => void;
  onRemoveServiceFromProject: (projectName: string, serviceName: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  services,
  onAddProject,
  onUpdateProject,
  onRemoveProject,
  onAddServiceToProject,
  onRemoveServiceFromProject
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [envVars, setEnvVars] = useState<{key: string, value: string}[]>([{key: "", value: ""}]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingEnvVars, setEditingEnvVars] = useState<{key: string, value: string}[]>([]);

  const handleAddProject = () => {
    if (!newProjectName) return;
    
    const environment: Record<string, string> = {};
    envVars.forEach(({key, value}) => {
      if (key) environment[key] = value;
    });
    
    onAddProject(newProjectName, environment);
    setNewProjectName("");
    setEnvVars([{key: "", value: ""}]);
    setShowAddForm(false);
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, {key: "", value: ""}]);
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...envVars];
    newEnvVars[index][field] = value;
    setEnvVars(newEnvVars);
  };

  const removeEnvVar = (index: number) => {
    if (envVars.length === 1) return;
    const newEnvVars = [...envVars];
    newEnvVars.splice(index, 1);
    setEnvVars(newEnvVars);
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project.slug === selectedProject ? null : project.slug);
  };

  const getAvailableServices = (project: Project) => {
    return services.filter(service => !project.services.includes(service.name));
  };

  const handleStartEditing = (project: Project) => {
    setEditingProject(project.name);
    setEditingEnvVars(
      Object.entries(project.environment).map(([key, value]) => ({ key, value }))
    );
    if (editingEnvVars.length === 0) {
      setEditingEnvVars([{ key: "", value: "" }]);
    }
  };

  const handleSaveEdit = (projectName: string) => {
    const environment: Record<string, string> = {};
    editingEnvVars.forEach(({ key, value }) => {
      if (key) environment[key] = value;
    });
    
    onUpdateProject(projectName, environment);
    setEditingProject(null);
  };

  const updateEditingEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...editingEnvVars];
    newEnvVars[index][field] = value;
    setEditingEnvVars(newEnvVars);
  };

  const addEditingEnvVar = () => {
    setEditingEnvVars([...editingEnvVars, { key: "", value: "" }]);
  };

  const removeEditingEnvVar = (index: number) => {
    if (editingEnvVars.length === 1) return;
    const newEnvVars = [...editingEnvVars];
    newEnvVars.splice(index, 1);
    setEditingEnvVars(newEnvVars);
  };

  return (
    <div className="projects-view">
      <div className="projects-header">
        <h1>Projects</h1>
        <button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? "Cancel" : "Add Project"}
        </button>
      </div>

      {showAddForm && (
        <div className="project-form">
          <h2>Add New Project</h2>
          <div className="form-group">
            <label>Project Name:</label>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g. my-laravel-app"
            />
          </div>
          
          <h3>Environment Variables</h3>
          {envVars.map((envVar, index) => (
            <div key={index} className="env-var-group">
              <input
                type="text"
                value={envVar.key}
                onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                placeholder="KEY"
              />
              <input
                type="text"
                value={envVar.value}
                onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                placeholder="value"
              />
              <button onClick={() => removeEnvVar(index)}>-</button>
            </div>
          ))}
          <button className="add-env-var" onClick={addEnvVar}>Add Environment Variable</button>
          
          <div className="form-actions">
            <button 
              className="submit-button" 
              onClick={handleAddProject}
              disabled={!newProjectName}
            >
              Create Project
            </button>
          </div>
        </div>
      )}

      <div className="projects-list">
        {projects.length === 0 ? (
          <div className="no-projects">
            <p>No projects created yet. Add a new project to get started.</p>
          </div>
        ) : (
          projects.map(project => (
            <div key={project.slug} className="project-card">
              <div 
                className="project-header"
                onClick={() => handleSelectProject(project)}
              >
                <h2>{project.name}</h2>
                <div className="project-url">{project.url}</div>
              </div>
              
              {selectedProject === project.slug && (
                <>
                  <div className="project-services">
                    <h3>Services</h3>
                    {project.services.length === 0 ? (
                      <p>No services added to this project.</p>
                    ) : (
                      <ul>
                        {project.services.map(serviceName => (
                          <li key={serviceName}>
                            {serviceName}
                            <button 
                              onClick={() => onRemoveServiceFromProject(project.name, serviceName)}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    
                    <div className="add-service">
                      <select>
                        <option value="">Select a service to add...</option>
                        {getAvailableServices(project).map(service => (
                          <option key={service.name} value={service.name}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                      <button 
                        onClick={(e) => {
                          const select = e.currentTarget.previousElementSibling as HTMLSelectElement;
                          if (select.value) {
                            onAddServiceToProject(project.name, select.value);
                            select.value = "";
                          }
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  
                  <div className="project-environment">
                    <h3>Environment Variables</h3>
                    {editingProject === project.name ? (
                      <div className="edit-environment">
                        {editingEnvVars.map((envVar, index) => (
                          <div key={index} className="env-var-group">
                            <input
                              type="text"
                              value={envVar.key}
                              onChange={(e) => updateEditingEnvVar(index, 'key', e.target.value)}
                              placeholder="KEY"
                            />
                            <input
                              type="text"
                              value={envVar.value}
                              onChange={(e) => updateEditingEnvVar(index, 'value', e.target.value)}
                              placeholder="value"
                            />
                            <button onClick={() => removeEditingEnvVar(index)}>-</button>
                          </div>
                        ))}
                        <button className="add-env-var" onClick={addEditingEnvVar}>
                          Add Environment Variable
                        </button>
                        <div className="edit-actions">
                          <button 
                            className="save-button"
                            onClick={() => handleSaveEdit(project.name)}
                          >
                            Save Changes
                          </button>
                          <button 
                            className="cancel-button"
                            onClick={() => setEditingProject(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {Object.keys(project.environment).length === 0 ? (
                          <p>No environment variables defined.</p>
                        ) : (
                          <ul>
                            {Object.entries(project.environment).map(([key, value]) => (
                              <li key={key}>
                                <strong>{key}:</strong> {value}
                              </li>
                            ))}
                          </ul>
                        )}
                        <button 
                          className="edit-button"
                          onClick={() => handleStartEditing(project)}
                        >
                          Edit Environment Variables
                        </button>
                      </>
                    )}
                  </div>
                  
                  <div className="project-actions">
                    <button 
                      className="remove-button"
                      onClick={() => onRemoveProject(project.name)}
                    >
                      Remove Project
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
