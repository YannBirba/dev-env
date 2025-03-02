import React from "react";
import { invoke } from "@tauri-apps/api/core";
import "./Sidebar.css";

enum View {
  Home,
  Projects,
  Services,
  Config
}

interface SidebarProps {
  currentView: View;
  onSelectView: (view: View) => void;
  isEnvironmentRunning: boolean;
  onStartEnvironment: () => void;
  onStopEnvironment: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  isEnvironmentRunning,
  onStartEnvironment,
  onStopEnvironment
}) => {
  const handleReset = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir réinitialiser toute la configuration ? Cette action supprimera tous vos services et projets.")) {
      await invoke("stop_environment");
      await invoke("reset_config");
      window.location.reload(); // Recharger l'application
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Dev Environment</h2>
      </div>
      
      <div className="sidebar-menu">
        <div 
          className={`sidebar-item ${currentView === View.Home ? "active" : ""}`}
          onClick={() => onSelectView(View.Home)}
        >
          <span className="icon">🏠</span>
          <span>Home</span>
        </div>
        
        <div 
          className={`sidebar-item ${currentView === View.Projects ? "active" : ""}`}
          onClick={() => onSelectView(View.Projects)}
        >
          <span className="icon">📂</span>
          <span>Projects</span>
        </div>
        
        <div 
          className={`sidebar-item ${currentView === View.Services ? "active" : ""}`}
          onClick={() => onSelectView(View.Services)}
        >
          <span className="icon">🔧</span>
          <span>Services</span>
        </div>
        
        <div 
          className={`sidebar-item ${currentView === View.Config ? "active" : ""}`}
          onClick={() => onSelectView(View.Config)}
        >
          <span className="icon">⚙️</span>
          <span>Configuration</span>
        </div>
      </div>
      
      <div className="sidebar-footer">
        {isEnvironmentRunning ? (
          <button 
            className="stop-button"
            onClick={onStopEnvironment}
          >
            Stop Environment
          </button>
        ) : (
          <button 
            className="start-button"
            onClick={onStartEnvironment}
          >
            Start Environment
          </button>
        )}
        <button 
          className="reset-button"
          onClick={handleReset}
        >
          Réinitialiser la Configuration
        </button>
      </div>
    </div>
  );
};
