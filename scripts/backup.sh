#!/bin/bash
# ──────────────────────────────────────────────────────────────────────
# Unnatify CRM — PostgreSQL Backup Script
# Intended to be run via cron, e.g.:
#   0 2 * * * /opt/unnatify-crm/scripts/backup.sh >> /opt/unnatify-crm/logs/backup.log 2>&1
# ──────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/unnatify-crm/backups/postgres}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/unnatify-crm}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/unnatify_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starting PostgreSQL backup..."

# Run pg_dump inside the postgres container
docker compose -f "${COMPOSE_DIR}/docker-compose.yml" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-unnatify}" "${POSTGRES_DB:-unnatify}" \
  | gzip > "${BACKUP_FILE}"

BACKUP_SIZE=$(stat -f%z "${BACKUP_FILE}" 2>/dev/null || stat --printf="%s" "${BACKUP_FILE}" 2>/dev/null || echo "unknown")
echo "[$(date -Iseconds)] Backup created: ${BACKUP_FILE} (${BACKUP_SIZE} bytes)"

# Prune old backups
PRUNED=$(find "${BACKUP_DIR}" -name "unnatify_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
echo "[$(date -Iseconds)] Pruned ${PRUNED} backup(s) older than ${RETENTION_DAYS} days"

echo "[$(date -Iseconds)] Backup complete."
