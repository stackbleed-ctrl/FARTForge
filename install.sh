#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
#  FARTForge — One-Click Pro Installer
#  github.com/stackbleed-ctrl/FARTForge
#  May the smelliest agent win. 💨
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────
GREEN="\e[32m"
BLUE="\e[34m"
CYAN="\e[36m"
YELLOW="\e[33m"
RED="\e[31m"
BOLD="\e[1m"
RESET="\e[0m"

# ── Config ────────────────────────────────────────────────────────
REPO_URL="https://github.com/stackbleed-ctrl/FARTForge.git"
REPO_DIR="FARTForge"
UI_DIR="$REPO_DIR/ui"
PY_DIR="$REPO_DIR"
NODE_VERSION="20"
PYTHON_MIN="3.10"
APP_PORT="3000"
PM2_APP_NAME="fartforge"
LOG_FILE="/tmp/fartforge-install.log"
VERSION="1.0.0"

# ── Helpers ───────────────────────────────────────────────────────
log()     { echo -e "${BLUE}${BOLD}➜${RESET}  $1"; }
success() { echo -e "${GREEN}${BOLD}✔${RESET}  $1"; }
warn()    { echo -e "${YELLOW}${BOLD}⚠${RESET}  $1"; }
error()   { echo -e "${RED}${BOLD}✖${RESET}  $1"; }
section() { echo -e "\n${CYAN}${BOLD}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"; }
banner()  {
  echo -e "${GREEN}${BOLD}"
  cat << 'EOF'
  ███████╗ █████╗ ██████╗ ████████╗███████╗ ██████╗ ██████╗  ██████╗ ███████╗
  ██╔════╝██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝
  █████╗  ███████║██████╔╝   ██║   █████╗  ██║   ██║██████╔╝██║  ███╗█████╗  
  ██╔══╝  ██╔══██║██╔══██╗   ██║   ██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  
  ██║     ██║  ██║██║  ██║   ██║   ██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗
  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝
EOF
  echo -e "${RESET}"
  echo -e "  ${CYAN}World's First AI-Agent Fart Analytics Platform${RESET}"
  echo -e "  ${YELLOW}May the smelliest agent win 💨${RESET}"
  echo -e "  ${BLUE}v${VERSION} — One-Click Pro Installer${RESET}\n"
}

# ── OS Detection ──────────────────────────────────────────────────
detect_os() {
  section "Detecting OS"
  OS=""
  PKG=""

  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v apt-get &>/dev/null; then
      OS="debian"
      PKG="apt"
      success "Detected: Debian/Ubuntu Linux"
    elif command -v dnf &>/dev/null; then
      OS="fedora"
      PKG="dnf"
      success "Detected: Fedora/RHEL Linux"
    elif command -v pacman &>/dev/null; then
      OS="arch"
      PKG="pacman"
      success "Detected: Arch Linux"
    else
      OS="linux"
      PKG="unknown"
      warn "Linux detected but package manager unknown — manual install may be needed"
    fi
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
    PKG="brew"
    success "Detected: macOS"
  else
    error "Unsupported OS: $OSTYPE"
    exit 1
  fi

  # Architecture
  ARCH=$(uname -m)
  success "Architecture: $ARCH"
}

# ── Dependency installer ──────────────────────────────────────────
pkg_install() {
  local pkg=$1
  log "Installing $pkg..."
  case $PKG in
    apt)    sudo apt-get install -y "$pkg" >> "$LOG_FILE" 2>&1 ;;
    dnf)    sudo dnf install -y "$pkg"     >> "$LOG_FILE" 2>&1 ;;
    pacman) sudo pacman -S --noconfirm "$pkg" >> "$LOG_FILE" 2>&1 ;;
    brew)   brew install "$pkg"            >> "$LOG_FILE" 2>&1 ;;
    *)      warn "Cannot auto-install $pkg — please install manually" ;;
  esac
}

# ── System update ─────────────────────────────────────────────────
update_system() {
  section "Updating System"
  log "Updating package lists..."
  case $PKG in
    apt)    sudo apt-get update -y >> "$LOG_FILE" 2>&1 ;;
    dnf)    sudo dnf check-update -y >> "$LOG_FILE" 2>&1 || true ;;
    pacman) sudo pacman -Sy >> "$LOG_FILE" 2>&1 ;;
    brew)   brew update >> "$LOG_FILE" 2>&1 ;;
  esac
  success "System updated"
}

# ── Install Git ───────────────────────────────────────────────────
install_git() {
  section "Git"
  if command -v git &>/dev/null; then
    success "Git already installed: $(git --version)"
  else
    pkg_install git
    success "Git installed: $(git --version)"
  fi
}

# ── Install curl/wget ─────────────────────────────────────────────
install_curl() {
  if ! command -v curl &>/dev/null; then
    pkg_install curl
  fi
  success "curl available"
}

# ── Install Node.js ───────────────────────────────────────────────
install_node() {
  section "Node.js"
  if command -v node &>/dev/null; then
    NODE_CURRENT=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_CURRENT" -ge "$NODE_VERSION" ]; then
      success "Node.js already installed: $(node -v)"
      return
    else
      warn "Node.js $(node -v) is too old (need v${NODE_VERSION}+). Upgrading..."
    fi
  fi

  log "Installing Node.js v${NODE_VERSION}..."
  case $OS in
    debian)
      curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | sudo -E bash - >> "$LOG_FILE" 2>&1
      sudo apt-get install -y nodejs >> "$LOG_FILE" 2>&1
      ;;
    fedora)
      curl -fsSL "https://rpm.nodesource.com/setup_${NODE_VERSION}.x" | sudo bash - >> "$LOG_FILE" 2>&1
      sudo dnf install -y nodejs >> "$LOG_FILE" 2>&1
      ;;
    arch)
      sudo pacman -S --noconfirm nodejs npm >> "$LOG_FILE" 2>&1
      ;;
    mac)
      if command -v brew &>/dev/null; then
        brew install node >> "$LOG_FILE" 2>&1
      else
        error "Homebrew not found. Install from https://brew.sh first."
        exit 1
      fi
      ;;
  esac
  success "Node.js installed: $(node -v)"
  success "npm installed: $(npm -v)"
}

# ── Install Python ────────────────────────────────────────────────
install_python() {
  section "Python"
  if command -v python3 &>/dev/null; then
    PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    PY_MAJOR=$(echo $PY_VER | cut -d. -f1)
    PY_MINOR=$(echo $PY_VER | cut -d. -f2)
    if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 10 ]; then
      success "Python already installed: $(python3 --version)"
      return
    else
      warn "Python $PY_VER is too old (need 3.10+)"
    fi
  fi

  log "Installing Python 3.10+..."
  case $OS in
    debian)
      sudo apt-get install -y python3 python3-pip python3-venv >> "$LOG_FILE" 2>&1
      ;;
    fedora)
      sudo dnf install -y python3 python3-pip >> "$LOG_FILE" 2>&1
      ;;
    arch)
      sudo pacman -S --noconfirm python python-pip >> "$LOG_FILE" 2>&1
      ;;
    mac)
      brew install python@3.11 >> "$LOG_FILE" 2>&1
      ;;
  esac
  success "Python installed: $(python3 --version)"
}

# ── Install audio deps (for fart synthesis) ───────────────────────
install_audio_deps() {
  section "Audio Dependencies"
  log "Installing libsndfile + portaudio (for fart sound synthesis)..."
  case $OS in
    debian)
      sudo apt-get install -y libsndfile1 portaudio19-dev ffmpeg >> "$LOG_FILE" 2>&1
      ;;
    fedora)
      sudo dnf install -y libsndfile portaudio-devel ffmpeg >> "$LOG_FILE" 2>&1 || warn "Some audio packages may need RPM Fusion"
      ;;
    arch)
      sudo pacman -S --noconfirm libsndfile portaudio ffmpeg >> "$LOG_FILE" 2>&1
      ;;
    mac)
      brew install libsndfile portaudio ffmpeg >> "$LOG_FILE" 2>&1
      ;;
  esac
  success "Audio dependencies installed"
}

# ── Clone or update repo ──────────────────────────────────────────
clone_repo() {
  section "Repository"
  if [ -d "$REPO_DIR/.git" ]; then
    log "Repo already exists — pulling latest changes..."
    cd "$REPO_DIR"
    git pull origin main >> "$LOG_FILE" 2>&1 || git pull origin master >> "$LOG_FILE" 2>&1
    cd ..
    success "Repo updated to latest"
  else
    log "Cloning FARTForge from GitHub..."
    git clone "$REPO_URL" "$REPO_DIR" >> "$LOG_FILE" 2>&1
    success "Repo cloned"
  fi
}

# ── Python virtual env + package ─────────────────────────────────
install_python_package() {
  section "Python Package (fartforge)"
  cd "$PY_DIR"

  log "Creating Python virtual environment..."
  python3 -m venv .venv >> "$LOG_FILE" 2>&1
  source .venv/bin/activate

  log "Upgrading pip..."
  pip install --upgrade pip >> "$LOG_FILE" 2>&1

  log "Installing fartforge Python package..."
  if [ -f "pyproject.toml" ]; then
    pip install -e ".[all]" >> "$LOG_FILE" 2>&1
  else
    pip install fartforge >> "$LOG_FILE" 2>&1
  fi

  success "Python package installed"

  # Quick smoke test
  log "Running smoke test..."
  python3 -c "from fartforge import FartEmitter; print('💨 Python package OK')" && success "Smoke test passed" || warn "Smoke test failed — check logs"

  deactivate
  cd ..
}

# ── npm install ───────────────────────────────────────────────────
install_npm_deps() {
  section "UI Dependencies (npm)"
  if [ -d "$UI_DIR" ]; then
    cd "$UI_DIR"
  else
    # Flat repo structure
    cd "$REPO_DIR"
  fi

  log "Installing npm packages (this takes 1-2 min)..."
  npm install --legacy-peer-deps >> "$LOG_FILE" 2>&1
  success "npm packages installed"
  cd - > /dev/null
}

# ── Environment file ──────────────────────────────────────────────
setup_env() {
  section "Environment Configuration"

  # Find the right directory
  ENV_DIR="$UI_DIR"
  [ -d "$UI_DIR" ] || ENV_DIR="$REPO_DIR"

  if [ -f "$ENV_DIR/.env.local" ]; then
    success ".env.local already exists — skipping"
    return
  fi

  log "Creating .env.local from template..."

  if [ -f "$ENV_DIR/.env.example" ]; then
    cp "$ENV_DIR/.env.example" "$ENV_DIR/.env.local"
    success ".env.local created from .env.example"
  else
    cat > "$ENV_DIR/.env.local" << 'EOF'
# ═══════════════════════════════════════════════
#  FARTForge Environment Variables
#  Fill these in to unlock full features
# ═══════════════════════════════════════════════

# Supabase (cloud leaderboard + realtime)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Solana
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_FART_TOKEN_MINT=

# Price data
BIRDEYE_API_KEY=

# X/Twitter firehose (optional)
TWITTER_BEARER_TOKEN=
EOF
    success ".env.local created"
  fi

  warn "Edit $ENV_DIR/.env.local to add your API keys"
}

# ── Install PM2 ───────────────────────────────────────────────────
install_pm2() {
  section "PM2 Process Manager"
  if command -v pm2 &>/dev/null; then
    success "PM2 already installed: $(pm2 -v)"
  else
    log "Installing PM2 globally..."
    sudo npm install -g pm2 >> "$LOG_FILE" 2>&1
    success "PM2 installed: $(pm2 -v)"
  fi
}

# ── Register global CLI command ───────────────────────────────────
install_cli() {
  section "Global CLI (fartforge command)"

  SCRIPT_PATH="$(realpath install.sh)"
  CLI_PATH="/usr/local/bin/fartforge"

  cat > /tmp/fartforge-cli << CLIFILE
#!/bin/bash
# FARTForge global CLI launcher
INSTALL_DIR="$(realpath $REPO_DIR)"
UI_DIR="\$INSTALL_DIR/ui"
[ -d "\$UI_DIR" ] || UI_DIR="\$INSTALL_DIR"

case "\${1:-start}" in
  start)
    echo "💨 Starting FARTForge..."
    cd "\$UI_DIR" && pm2 start npm --name "$PM2_APP_NAME" -- run dev 2>/dev/null || npm run dev
    ;;
  stop)
    pm2 stop "$PM2_APP_NAME" 2>/dev/null || echo "Not running via PM2"
    ;;
  restart)
    pm2 restart "$PM2_APP_NAME" 2>/dev/null || echo "Not running via PM2"
    ;;
  logs)
    pm2 logs "$PM2_APP_NAME"
    ;;
  update)
    cd "$(realpath $REPO_DIR)" && git pull && cd "\$UI_DIR" && npm install --legacy-peer-deps && pm2 restart "$PM2_APP_NAME"
    echo "✔ FARTForge updated"
    ;;
  status)
    pm2 status "$PM2_APP_NAME" 2>/dev/null || echo "Use 'fartforge start' to launch"
    ;;
  *)
    echo "Usage: fartforge [start|stop|restart|logs|update|status]"
    ;;
esac
CLIFILE

  sudo mv /tmp/fartforge-cli "$CLI_PATH"
  sudo chmod +x "$CLI_PATH"
  success "Global CLI installed — run: fartforge"
}

# ── Start with PM2 ────────────────────────────────────────────────
start_app() {
  section "Launching FARTForge"

  APP_DIR="$UI_DIR"
  [ -d "$UI_DIR" ] || APP_DIR="$REPO_DIR"

  cd "$APP_DIR"

  # Stop any existing instance
  pm2 stop "$PM2_APP_NAME" >> "$LOG_FILE" 2>&1 || true
  pm2 delete "$PM2_APP_NAME" >> "$LOG_FILE" 2>&1 || true

  log "Starting FARTForge with PM2..."
  pm2 start npm --name "$PM2_APP_NAME" -- run dev >> "$LOG_FILE" 2>&1
  pm2 save >> "$LOG_FILE" 2>&1

  # Setup PM2 to auto-start on reboot
  log "Configuring auto-start on boot..."
  pm2 startup >> "$LOG_FILE" 2>&1 || warn "Auto-start setup requires running: sudo pm2 startup"

  cd - > /dev/null
  success "FARTForge launched via PM2"
}

# ── Final summary ─────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════${RESET}"
  echo -e "${GREEN}${BOLD}  💨 FARTFORGE INSTALLED SUCCESSFULLY               ${RESET}"
  echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════${RESET}"
  echo ""
  echo -e "  ${CYAN}🌐 Arena URL:${RESET}      http://localhost:${APP_PORT}"
  echo -e "  ${CYAN}📋 Logs:${RESET}           fartforge logs"
  echo -e "  ${CYAN}🔄 Restart:${RESET}        fartforge restart"
  echo -e "  ${CYAN}⬆️  Update:${RESET}         fartforge update"
  echo -e "  ${CYAN}⏹  Stop:${RESET}           fartforge stop"
  echo -e "  ${CYAN}📄 Install log:${RESET}    $LOG_FILE"
  echo ""
  echo -e "  ${YELLOW}⚙️  Add API keys:${RESET}   ${UI_DIR}/.env.local"
  echo -e "  ${YELLOW}   (Supabase, Birdeye, Twitter, Solana mint)${RESET}"
  echo ""
  echo -e "  ${GREEN}May the smelliest agent win. 💨🧪${RESET}"
  echo ""
}

# ═══════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════
main() {
  # Init log
  echo "FARTForge install started: $(date)" > "$LOG_FILE"

  banner
  detect_os
  update_system
  install_curl
  install_git
  install_node
  install_python
  install_audio_deps
  clone_repo
  install_python_package
  install_npm_deps
  setup_env
  install_pm2
  install_cli
  start_app
  print_summary
}

main "$@"
