import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./ServicesView.css";

interface Service {
  name: string;
  image: string;
  ports: string[];
  volumes: string[];
  global: boolean;
  dependencies: string[];
  config: Record<string, string>;
}

interface PredefinedService {
  name: string;
  image: string;
  description: string;
  port: number | null;
  requires_traefik: boolean;
  environment: Record<string, string>;
  volumes: string[];
}

interface ServicesViewProps {
  services: Service[];
  onAddService: (service: Service) => void;
  onRemoveService: (name: string) => void;
  onUpdateService: (service: Service) => void;
}

export const ServicesView: React.FC<ServicesViewProps> = ({
  services,
  onAddService,
  onRemoveService,
  onUpdateService
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [predefinedServices, setPredefinedServices] = useState<PredefinedService[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newService, setNewService] = useState<Service>({
    name: "",
    image: "",
    ports: [],
    volumes: [],
    global: false,
    dependencies: [],
    config: {}
  });
  const [newPort, setNewPort] = useState("");
  const [newVolume, setNewVolume] = useState("");
  const [newDependency, setNewDependency] = useState("");
  const [newConfigKey, setNewConfigKey] = useState("");
  const [newConfigValue, setNewConfigValue] = useState("");

  useEffect(() => {
    loadPredefinedServices();
  }, []);

  const loadPredefinedServices = async () => {
    try {
      const services = await invoke<PredefinedService[]>("list_predefined_services");
      setPredefinedServices(services);
    } catch (error) {
      console.error("Error loading predefined services:", error);
    }
  };

  const handleServiceSelect = (serviceName: string) => {
    setSelectedService(serviceName === selectedService ? null : serviceName);
  };

  const handleEditService = (service: Service) => {
    setEditingService({ ...service });
    setShowAddForm(true);
  };

  const handleAddPredefinedService = async (name: string) => {
    setIsLoading(true);
    try {
      await invoke("add_predefined_service", { name });
      const config = await invoke<string>("generate_docker_compose");
      await invoke("save_docker_compose", { content: config });
      await invoke("start_environment");
      
      // Recharger la liste des services après l'ajout
      const updatedServices = await invoke<Service[]>("list_services");
      onAddService(updatedServices.find(s => s.name === name)!);
      
      setStatusMessage(`Service ${name} ajouté et démarré avec succès`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error: any) {
      setStatusMessage(`Erreur: ${error}`);
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const serviceToSave = editingService || newService;

      // Vérifier que le service ne dépend pas de lui-même
      if (serviceToSave.dependencies.includes(serviceToSave.name)) {
        throw new Error("Un service ne peut pas dépendre de lui-même");
      }
      
      if (editingService) {
        await invoke("update_service", { service: serviceToSave });
        onUpdateService(serviceToSave);

        // Régénérer et redémarrer automatiquement
        const config = await invoke<string>("generate_docker_compose");
        await invoke("save_docker_compose", { content: config });
        await invoke("start_environment");
      } else {
        await invoke("add_service", { service: serviceToSave });
        onAddService(serviceToSave);
      }
      
      setShowAddForm(false);
      setEditingService(null);
      setNewService({
        name: "",
        image: "",
        ports: [],
        volumes: [],
        global: false,
        dependencies: [],
        config: {}
      });
      
      setStatusMessage(`Service ${serviceToSave.name} ${editingService ? 'mis à jour' : 'ajouté'} et démarré avec succès`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error: any) {
      setStatusMessage(`Erreur: ${error}`);
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const addPort = () => {
    if (!newPort) return;
    if (editingService) {
      setEditingService({
        ...editingService,
        ports: [...editingService.ports, newPort]
      });
    } else {
      setNewService({
        ...newService,
        ports: [...newService.ports, newPort]
      });
    }
    setNewPort("");
  };

  const removePort = (index: number) => {
    if (editingService) {
      const newPorts = [...editingService.ports];
      newPorts.splice(index, 1);
      setEditingService({
        ...editingService,
        ports: newPorts
      });
    } else {
      const newPorts = [...newService.ports];
      newPorts.splice(index, 1);
      setNewService({
        ...newService,
        ports: newPorts
      });
    }
  };

  const addVolume = () => {
    if (!newVolume) return;
    if (editingService) {
      setEditingService({
        ...editingService,
        volumes: [...editingService.volumes, newVolume]
      });
    } else {
      setNewService({
        ...newService,
        volumes: [...newService.volumes, newVolume]
      });
    }
    setNewVolume("");
  };

  const removeVolume = (index: number) => {
    if (editingService) {
      const newVolumes = [...editingService.volumes];
      newVolumes.splice(index, 1);
      setEditingService({
        ...editingService,
        volumes: newVolumes
      });
    } else {
      const newVolumes = [...newService.volumes];
      newVolumes.splice(index, 1);
      setNewService({
        ...newService,
        volumes: newVolumes
      });
    }
  };

  const addDependency = () => {
    if (!newDependency) return;
    if (editingService) {
      setEditingService({
        ...editingService,
        dependencies: [...editingService.dependencies, newDependency]
      });
    } else {
      setNewService({
        ...newService,
        dependencies: [...newService.dependencies, newDependency]
      });
    }
    setNewDependency("");
  };

  const removeDependency = (index: number) => {
    if (editingService) {
      const newDependencies = [...editingService.dependencies];
      newDependencies.splice(index, 1);
      setEditingService({
        ...editingService,
        dependencies: newDependencies
      });
    } else {
      const newDependencies = [...newService.dependencies];
      newDependencies.splice(index, 1);
      setNewService({
        ...newService,
        dependencies: newDependencies
      });
    }
  };

  const addConfig = () => {
    if (!newConfigKey) return;
    if (editingService) {
      setEditingService({
        ...editingService,
        config: {
          ...editingService.config,
          [newConfigKey]: newConfigValue
        }
      });
    } else {
      setNewService({
        ...newService,
        config: {
          ...newService.config,
          [newConfigKey]: newConfigValue
        }
      });
    }
    setNewConfigKey("");
    setNewConfigValue("");
  };

  const removeConfig = (key: string) => {
    if (editingService) {
      const newConfig = { ...editingService.config };
      delete newConfig[key];
      setEditingService({
        ...editingService,
        config: newConfig
      });
    } else {
      const newConfig = { ...newService.config };
      delete newConfig[key];
      setNewService({
        ...newService,
        config: newConfig
      });
    }
  };

  return (
    <div className="services-view">
      {statusMessage && (
        <div className={`status-message ${statusMessage.startsWith('Erreur') ? 'error' : 'success'}`}>
          {statusMessage}
        </div>
      )}

      <div className="services-header">
        <h1>Services</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} disabled={isLoading}>
          {showAddForm ? "Annuler" : "Ajouter un Service"}
        </button>
      </div>

      <div className="predefined-services">
        <h2>Services Prédéfinis</h2>
        <div className="predefined-grid">
          {predefinedServices.map(service => (
            <div key={service.name} className="predefined-card">
              <h3>{service.name}</h3>
              <p>{service.description}</p>
              <button
                onClick={() => handleAddPredefinedService(service.name)}
                disabled={isLoading || services.some(s => s.name === service.name)}
              >
                {services.some(s => s.name === service.name) 
                  ? "Déjà Installé" 
                  : isLoading 
                    ? "Installation..." 
                    : "Installer"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {showAddForm && (
        <div className="service-form">
          <h2>{editingService ? "Edit Service" : "Add New Service"}</h2>
          
          <div className="form-group">
            <label>Service Name:</label>
            <input
              type="text"
              value={editingService ? editingService.name : newService.name}
              onChange={(e) => {
                if (editingService) {
                  setEditingService({ ...editingService, name: e.target.value });
                } else {
                  setNewService({ ...newService, name: e.target.value });
                }
              }}
              disabled={!!editingService}
              placeholder="e.g. mysql"
            />
          </div>
          
          <div className="form-group">
            <label>Docker Image:</label>
            <input
              type="text"
              value={editingService ? editingService.image : newService.image}
              onChange={(e) => {
                if (editingService) {
                  setEditingService({ ...editingService, image: e.target.value });
                } else {
                  setNewService({ ...newService, image: e.target.value });
                }
              }}
              placeholder="e.g. mysql:8"
            />
          </div>
          
          <div className="form-group">
            <label>Global Service:</label>
            <input
              type="checkbox"
              checked={editingService ? editingService.global : newService.global}
              onChange={(e) => {
                if (editingService) {
                  setEditingService({ ...editingService, global: e.target.checked });
                } else {
                  setNewService({ ...newService, global: e.target.checked });
                }
              }}
            />
            <span className="checkbox-label">Make this service available to all projects</span>
          </div>
          
          <div className="form-section">
            <h3>Ports</h3>
            <div className="add-item">
              <input
                type="text"
                value={newPort}
                onChange={(e) => setNewPort(e.target.value)}
                placeholder="e.g. 3306:3306"
              />
              <button onClick={addPort}>Add</button>
            </div>
            <ul className="item-list">
              {(editingService ? editingService.ports : newService.ports).map((port, index) => (
                <li key={index}>
                  {port}
                  <button onClick={() => removePort(index)}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="form-section">
            <h3>Volumes</h3>
            <div className="add-item">
              <input
                type="text"
                value={newVolume}
                onChange={(e) => setNewVolume(e.target.value)}
                placeholder="e.g. ./data:/var/lib/mysql"
              />
              <button onClick={addVolume}>Add</button>
            </div>
            <ul className="item-list">
              {(editingService ? editingService.volumes : newService.volumes).map((volume, index) => (
                <li key={index}>
                  {volume}
                  <button onClick={() => removeVolume(index)}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="form-section">
            <h3>Dependencies</h3>
            <div className="add-item">
              <select
                value={newDependency}
                onChange={(e) => setNewDependency(e.target.value)}
              >
                <option value="">Select a service...</option>
                {services.map(service => (
                  <option key={service.name} value={service.name}>
                    {service.name}
                  </option>
                ))}
              </select>
              <button onClick={addDependency}>Add</button>
            </div>
            <ul className="item-list">
              {(editingService ? editingService.dependencies : newService.dependencies).map((dependency, index) => (
                <li key={index}>
                  {dependency}
                  <button onClick={() => removeDependency(index)}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="form-section">
            <h3>Environment Variables</h3>
            <div className="add-env">
              <input
                type="text"
                value={newConfigKey}
                onChange={(e) => setNewConfigKey(e.target.value)}
                placeholder="KEY"
              />
              <input
                type="text"
                value={newConfigValue}
                onChange={(e) => setNewConfigValue(e.target.value)}
                placeholder="value"
              />
              <button onClick={addConfig}>Add</button>
            </div>
            <ul className="item-list">
              {Object.entries(editingService ? editingService.config : newService.config).map(([key, value]) => (
                <li key={key}>
                  <strong>{key}:</strong> {value}
                  <button onClick={() => removeConfig(key)}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="form-actions">
            <button 
              className="submit-button" 
              onClick={handleServiceSubmit}
              disabled={isLoading || editingService ? (!editingService?.name || !editingService?.image) : (!newService.name || !newService.image)}
            >
              {editingService ? "Update Service" : "Create Service"}
              {isLoading && "..."}
            </button>
          </div>
        </div>
      )}

      <div className="services-list">
        {services.length === 0 ? (
          <div className="no-services">
            <p>No services created yet. Add a new service to get started.</p>
          </div>
        ) : (
          services.map(service => (
            <div key={service.name} className="service-card">
              <div 
                className="service-header"
                onClick={() => handleServiceSelect(service.name)}
              >
                <h2>{service.name}</h2>
                <div className="service-image">{service.image}</div>
                <div className="service-tag">{service.global ? "Global" : "Custom"}</div>
              </div>
              
              {selectedService === service.name && (
                <>
                  <div className="service-details">
                    <div className="service-section">
                      <h3>Ports</h3>
                      {service.ports.length === 0 ? (
                        <p>No ports mapped.</p>
                      ) : (
                        <ul>
                          {service.ports.map((port, index) => (
                            <li key={index}>{port}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    
                    <div className="service-section">
                      <h3>Volumes</h3>
                      {service.volumes.length === 0 ? (
                        <p>No volumes mounted.</p>
                      ) : (
                        <ul>
                          {service.volumes.map((volume, index) => (
                            <li key={index}>{volume}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    
                    <div className="service-section">
                      <h3>Dependencies</h3>
                      {service.dependencies.length === 0 ? (
                        <p>No dependencies.</p>
                      ) : (
                        <ul>
                          {service.dependencies.map((dependency, index) => (
                            <li key={index}>{dependency}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    
                    <div className="service-section">
                      <h3>Environment Variables</h3>
                      {Object.keys(service.config).length === 0 ? (
                        <p>No environment variables defined.</p>
                      ) : (
                        <ul>
                          {Object.entries(service.config).map(([key, value]) => (
                            <li key={key}>
                              <strong>{key}:</strong> {value}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  
                  <div className="service-actions">
                    <button 
                      className="edit-button"
                      onClick={() => handleEditService(service)}
                    >
                      Edit Service
                    </button>
                    <button 
                      className="remove-button"
                      onClick={() => onRemoveService(service.name)}
                    >
                      Remove Service
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
