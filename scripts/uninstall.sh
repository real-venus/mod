#!/bin/bash

# mod Uninstall Script
# This script removes mod and its dependencies

echo "==========================================="
echo "       mod Uninstall Script"
echo "==========================================="
echo ""

# Get OS name
OS_NAME=$(uname)
echo "Detected OS: $OS_NAME"
echo ""

# Uninstall mod Python package
echo "=== Uninstalling mod Python Package ==="
if pip3 list | grep -q mod; then
    echo "Found mod package installed"
    if confirm "Do you want to uninstall the mod Python package?"; then
        pip3 uninstall -y mod
        echo "✓ mod package uninstalled"
    else
        echo "⚠ Skipping mod package uninstall"
    fi
else
    echo "⚠ mod package not found in pip"
fi
echo ""
