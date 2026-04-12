#!/bin/bash
set -e

# Install all mod dependencies: python, node/npm, docker
# Usage: ./install_deps.sh [--python] [--node] [--docker] [--all]
#   No args = --all

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

msg() { echo -e "${2:-$GREEN}[mod] $1${NC}"; }

OS_NAME=$(uname)

# ---- helpers per OS ----
pkg_install() {
    case "$OS_NAME" in
        Linux)
            sudo apt-get update -y
            sudo apt-get install -y "$@"
            ;;
        Darwin)
            if ! command -v brew &>/dev/null; then
                msg "Installing Homebrew..." "$YELLOW"
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install "$@"
            ;;
        MINGW*|CYGWIN*)
            if command -v choco &>/dev/null; then
                choco install -y "$@"
            else
                msg "Chocolatey not found. Install deps manually." "$RED"; exit 1
            fi
            ;;
        *) msg "Unsupported OS: $OS_NAME" "$RED"; exit 1 ;;
    esac
}

# ---- python ----
install_python() {
    msg "Checking Python..."
    if command -v python3 &>/dev/null; then
        msg "python3 $(python3 --version 2>&1 | awk '{print $2}') already installed"
    else
        msg "Installing Python3..." "$YELLOW"
        case "$OS_NAME" in
            Linux)  sudo apt-get update -y && sudo apt-get install -y python3 python3-pip python3-venv ;;
            Darwin) pkg_install python3 ;;
            *)      pkg_install python3 ;;
        esac
    fi
    if ! command -v pip3 &>/dev/null; then
        msg "Installing pip3..." "$YELLOW"
        python3 -m ensurepip --upgrade 2>/dev/null || pkg_install python3-pip
    fi
    msg "python3 $(python3 --version 2>&1 | awk '{print $2}'), pip $(pip3 --version 2>&1 | awk '{print $2}')"
}

# ---- node/npm ----
install_node() {
    msg "Checking Node.js..."
    if command -v node &>/dev/null; then
        msg "node $(node --version) already installed"
    else
        msg "Installing Node.js..." "$YELLOW"
        case "$OS_NAME" in
            Linux)
                curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
                sudo apt-get install -y nodejs
                ;;
            Darwin) pkg_install node ;;
            *)      pkg_install nodejs ;;
        esac
    fi
    if command -v npm &>/dev/null; then
        msg "npm $(npm --version)"
    fi
}

# ---- docker ----
install_docker() {
    msg "Checking Docker..."
    if command -v docker &>/dev/null; then
        msg "docker $(docker --version | awk '{print $3}') already installed"
        return
    fi
    msg "Installing Docker..." "$YELLOW"
    case "$OS_NAME" in
        Linux)
            sudo apt-get update -y
            sudo apt-get install -y ca-certificates curl gnupg lsb-release
            sudo mkdir -p /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
                | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            sudo apt-get update -y
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -aG docker "$USER"
            msg "Log out and back in for docker group to take effect." "$YELLOW"
            ;;
        Darwin)
            brew install --cask docker
            msg "Open Docker Desktop from Applications to finish setup." "$YELLOW"
            ;;
        *)
            msg "Install Docker Desktop manually: https://docker.com/products/docker-desktop" "$YELLOW"
            ;;
    esac
}

# ---- main ----
DO_PYTHON=false
DO_NODE=false
DO_DOCKER=false

if [ $# -eq 0 ]; then
    DO_PYTHON=true; DO_NODE=true; DO_DOCKER=true
else
    for arg in "$@"; do
        case "$arg" in
            --python) DO_PYTHON=true ;;
            --node)   DO_NODE=true ;;
            --docker) DO_DOCKER=true ;;
            --all)    DO_PYTHON=true; DO_NODE=true; DO_DOCKER=true ;;
            *) msg "Unknown flag: $arg" "$RED"; exit 1 ;;
        esac
    done
fi

msg "=== mod dependency installer ($(uname)) ==="
$DO_PYTHON && install_python
$DO_NODE   && install_node
$DO_DOCKER && install_docker
msg "=== done ==="
