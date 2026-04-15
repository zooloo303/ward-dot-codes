#!/bin/bash
# MCP wrapper — SAP B25 (S/4 2025)
# Sources the master .env and maps B25-specific vars to the generic names
# the mcp-abap-abap-adt-api server expects.

set -a
source "$HOME/Projects/ward-dot-codes/.env"
set +a

exec env \
  SAP_URL="$SAP_B25_URL" \
  SAP_USER="$SAP_B25_USER" \
  SAP_PASSWORD="$SAP_B25_PASSWORD" \
  SAP_CLIENT="$SAP_B25_CLIENT" \
  SAP_LANGUAGE="EN" \
  NODE_TLS_REJECT_UNAUTHORIZED="0" \
  node /Users/neilward/Projects/tools/mcp-servers/mcp-abap-abap-adt-api/dist/index.js
