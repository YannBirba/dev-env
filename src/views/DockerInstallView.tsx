import React, { useState, useEffect } from "react";
import { platform } from "@tauri-apps/plugin-os";
import "./DockerInstallView.css";

export const DockerInstallView: React.FC = () => {
  const [userOS, setUserOS] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detectOS = async () => {
      try {
        const os = await platform();
        setUserOS(os);
      } catch (error) {
        console.error("Failed to detect OS:", error);
      } finally {
        setLoading(false);
      }
    };

    detectOS();
  }, []);

  // Fonction pour ordonner les cartes de plateformes en mettant celle de l'utilisateur en premier
  const getPlatformOrder = () => {
    if (!userOS) return ["windows", "macos", "linux"];
    
    switch(userOS.toLowerCase()) {
      case "win32":
        return ["windows", "macos", "linux"];
      case "darwin":
        return ["macos", "windows", "linux"];
      default:
        return ["linux", "windows", "macos"];
    }
  };

  const platformOrder = getPlatformOrder();

  // Contenu de la carte pour Windows
  const WindowsPlatformCard = () => (
    <div className={`platform-card ${userOS?.toLowerCase() === 'win32' ? 'current-os' : ''}`}>
      <div className="platform-header">
        <h2>🪟 Windows</h2>
        {userOS?.toLowerCase() === 'win32' && <span className="current-os-badge">Votre système</span>}
      </div>
      <div className="platform-content">
        <ol>
          <li>Téléchargez <a href="https://www.docker.com/products/docker-desktop" target="_blank" rel="noreferrer">Docker Desktop pour Windows</a></li>
          <li>Exécutez le fichier .exe téléchargé et suivez les instructions d'installation</li>
          <li>Assurez-vous que l'option WSL 2 est activée pendant l'installation</li>
          <li>Redémarrez votre ordinateur après l'installation</li>
          <li>Lancez Docker Desktop depuis le menu Démarrer</li>
        </ol>
        <div className="platform-note">
          <strong>Note:</strong> Vous devez activer la virtualisation dans le BIOS/UEFI de votre ordinateur si ce n'est pas déjà fait.
        </div>
      </div>
    </div>
  );

  // Contenu de la carte pour macOS
  const MacOSPlatformCard = () => (
    <div className={`platform-card ${userOS?.toLowerCase() === 'darwin' ? 'current-os' : ''}`}>
      <div className="platform-header">
        <h2>🍎 macOS</h2>
        {userOS?.toLowerCase() === 'darwin' && <span className="current-os-badge">Votre système</span>}
      </div>
      <div className="platform-content">
        <ol>
          <li>Téléchargez <a href="https://www.docker.com/products/docker-desktop" target="_blank" rel="noreferrer">Docker Desktop pour Mac</a> (Apple Silicon ou Intel selon votre Mac)</li>
          <li>Ouvrez le fichier .dmg téléchargé</li>
          <li>Glissez l'icône Docker vers votre dossier Applications</li>
          <li>Lancez Docker depuis le dossier Applications</li>
          <li>Attendez que Docker démarre complètement (l'icône dans la barre de menu arrêtera de s'animer)</li>
        </ol>
      </div>
    </div>
  );

  // Contenu de la carte pour Linux
  const LinuxPlatformCard = () => (
    <div className={`platform-card ${userOS && !['win32', 'darwin'].includes(userOS.toLowerCase()) ? 'current-os' : ''}`}>
      <div className="platform-header">
        <h2>🐧 Linux</h2>
        {userOS && !['win32', 'darwin'].includes(userOS.toLowerCase()) && <span className="current-os-badge">Votre système</span>}
      </div>
      <div className="platform-content">
        <h3>Ubuntu/Debian</h3>
        <pre><code>
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | sudo tee /etc/apt/sources.list.d/docker.list {">"} /dev/null
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        </code></pre>

        <h3>Fedora/CentOS/RHEL</h3>
        <pre><code>
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
sudo dnf install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
        </code></pre>

        <h3>Arch Linux</h3>
        <pre><code>
sudo pacman -S docker
sudo systemctl start docker
sudo systemctl enable docker
        </code></pre>

        <div className="platform-note">
          <strong>Note:</strong> Pour utiliser Docker sans sudo, ajoutez votre utilisateur au groupe docker :
          <pre><code>sudo usermod -aG docker $USER</code></pre>
          Déconnectez-vous et reconnectez-vous pour appliquer les changements.
        </div>
      </div>
    </div>
  );

  // Fonction pour générer les cartes dans l'ordre déterminé
  const renderPlatformCards = () => {
    const cards = {
      windows: <WindowsPlatformCard key="windows" />,
      macos: <MacOSPlatformCard key="macos" />,
      linux: <LinuxPlatformCard key="linux" />
    };

    return platformOrder.map(platform => cards[platform as keyof typeof cards]);
  };

  if (loading) {
    return (
      <div className="docker-install-container loading">
        <div className="loading-spinner"></div>
        <p>Détection de votre système d'exploitation...</p>
      </div>
    );
  }

  return (
    <div className="docker-install-container">
      <div className="docker-install-header">
        <h1>🐳 Docker n'est pas installé</h1>
        <p className="subtitle">Pour utiliser cette application, vous devez installer Docker sur votre système.</p>
      </div>

      <div className="platforms-container">
        {renderPlatformCards()}
      </div>

      <div className="docker-install-footer">
        <p>Une fois Docker installé, <strong>redémarrez l'application</strong> pour commencer à créer votre environnement de développement.</p>
        <div className="verification-tip">
          <h3>Comment vérifier que Docker est bien installé ?</h3>
          <p>Ouvrez un terminal et exécutez la commande suivante :</p>
          <pre><code>docker --version</code></pre>
          <p>Vous devriez voir la version de Docker s'afficher, confirmant que l'installation a réussi.</p>
        </div>
      </div>
    </div>
  );
};