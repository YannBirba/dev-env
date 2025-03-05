import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./ConfigView.css";

interface ConfigViewProps {
  onGenerateConfig: () => Promise<string | null>;
}

export const ConfigView: React.FC<ConfigViewProps> = ({ onGenerateConfig }) => {
  const [config, setConfig] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [configExists, setConfigExists] = useState<boolean>(false);

  useEffect(() => {
    const checkConfig = async () => {
      const exists = await invoke<boolean>("check_config_exists");
      setConfigExists(exists);
    };
    
    checkConfig();
  }, []);

  const handleGenerateConfig = async () => {
    setLoading(true);
    setSaveStatus(null);
    try {
      const generatedConfig = await onGenerateConfig();
      setConfig(generatedConfig);
      
      // Sauvegarder automatiquement la configuration
      if (generatedConfig) {
        await invoke('save_docker_compose', { content: generatedConfig });
        setSaveStatus(configExists 
          ? "Configuration mise à jour avec succès !"
          : "Configuration générée et sauvegardée avec succès !");
        setConfigExists(true);
        
        // Effacer le message après 3 secondes
        setTimeout(() => {
          setSaveStatus(null);
        }, 3000);
      }
    } catch (error) {
      console.error("Error generating config:", error);
      setSaveStatus("Erreur lors de la sauvegarde de la configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = () => {
    if (!config) return;
    
    const blob = new Blob([config], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'docker-compose.yml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="config-view">
      <div className="config-header">
        <h1>Configuration de l'Environnement Docker</h1>
        <p className="intro-text">
          Cette page vous permet de configurer votre environnement de développement Docker.
          Suivez les étapes ci-dessous pour générer et déployer votre configuration.
        </p>
      </div>

      <div className="setup-steps">
        <section className="step">
          <h2>1. Générer la Configuration</h2>
          <p>
            {configExists 
              ? "Une configuration Docker existe déjà. Vous pouvez la mettre à jour ou la télécharger :"
              : "Générez un fichier docker-compose.yml adapté à votre environnement :"}
          </p>
          <div className="config-actions">
            <button 
              className="generate-button primary-button"
              onClick={handleGenerateConfig}
              disabled={loading}
            >
              {loading 
                ? "Génération en cours..." 
                : configExists 
                  ? "Mettre à jour la Configuration"
                  : "Générer la Configuration"}
            </button>
          </div>
          {config && (
            <div className="config-display">
              <h3>Configuration Docker Générée</h3>
              {saveStatus && (
                <div className="save-status">
                  {saveStatus}
                </div>
              )}
              <pre>{config}</pre>
              <button 
                className="save-button secondary-button"
                onClick={handleSaveConfig}
              >
                Télécharger docker-compose.yml
              </button>
            </div>
          )}
        </section>

        <section className="step">
          <h2>2. Comprendre Votre Configuration</h2>
          <div className="config-details">
            <p>Votre configuration Docker inclut automatiquement :</p>
            <ul>
              <li>Traefik : Un proxy inverse avec support SSL</li>
              <li>Services globaux : MySQL, Redis, etc.</li>
              <li>Services spécifiques à vos projets</li>
              <li>Configuration réseau pour la communication entre services</li>
            </ul>
          </div>
          <div className="next-steps">
            <h3>Prochaines Étapes</h3>
            <p>Une fois votre configuration générée, vous pouvez :</p>
            <ol>
              <li>Enregistrer le fichier docker-compose.yml pour une utilisation manuelle</li>
              <li>Utiliser le bouton "Démarrer l'Environnement" dans l'onglet Services pour déployer automatiquement</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
};
