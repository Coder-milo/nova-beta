#!/usr/bin/env bash
# Script de aprovisionamiento inicial para Hostinger VPS (Ubuntu 22.04 / 24.04)
# Uso: chmod +x setup_vps.sh && ./setup_vps.sh

set -e

echo "=== 1. Actualizando paquetes del sistema ==="
sudo apt-get update && sudo apt-get upgrade -y

echo "=== 2. Instalando dependencias básicas y Nginx ==="
sudo apt-get install -y curl wget git ufw nginx certbot python3-certbot-nginx

echo "=== 3. Instalando Docker & Docker Compose ==="
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

echo "=== 4. Configurando Firewall (UFW) ==="
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "=== 5. Configuración completada ==="
echo "Para desplegar NOVA-CRM:"
echo "1. Clona el repositorio: git clone https://github.com/TheHector2614/NOVA-CRM.git"
echo "2. Crea tu archivo .env con las variables de producción."
echo "3. Ejecuta: docker compose up -d --build"
echo "4. Emite tus certificados SSL con: sudo certbot --nginx -d app.cacenglish.com.co -d api.cacenglish.com.co"
