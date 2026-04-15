#!/bin/bash
# MCP wrapper — SAP B23 (S/4 2023)
# Sources the master .env and maps B23-specific vars to the generic names
# the mcp-abap-abap-adt-api server expects.

set -a
source "$HOME/Projects/ward-dot-codes/.env"
set +a

exec env \
  SAP_URL="$SAP_B23_URL" \
  SAP_USER="$SAP_B23_USER" \
  SAP_PASSWORD="$SAP_B23_PASSWORD" \
  SAP_CLIENT="$SAP_B23_CLIENT" \
  SAP_LANGUAGE="EN" \
  NODE_TLS_REJECT_UNAUTHORIZED="0" \
  node /Users/neilward/Projects/tools/mcp-servers/mcp-abap-abap-adt-api/dist/index.js
