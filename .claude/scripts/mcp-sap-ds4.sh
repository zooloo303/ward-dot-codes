#!/bin/bash
# MCP wrapper — SAP DS4 (Avantus Aerospace)
# Sources the master .env and maps DS4-specific vars to the generic names
# the mcp-abap-abap-adt-api server expects.

set -a
source "$HOME/Projects/ward-dot-codes/.env"
set +a

exec env \
  SAP_URL="$SAP_DS4_URL" \
  SAP_USER="$SAP_DS4_USER" \
  SAP_PASSWORD="$SAP_DS4_PASSWORD" \
  SAP_CLIENT="$SAP_DS4_CLIENT" \
  SAP_LANGUAGE="EN" \
  NODE_TLS_REJECT_UNAUTHORIZED="0" \
  node /Users/neilward/Projects/tools/mcp-servers/mcp-abap-abap-adt-api/dist/index.js
