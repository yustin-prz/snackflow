#!/bin/bash
# sync-to-neon.sh
# Sincroniza la base de datos local hacia Neon (respaldo en la nube)
# Ejecutar manualmente o programar con una tarea automática

echo "Iniciando sincronización hacia Neon..."

# Exportar datos de la BD local
docker exec snackflow-db pg_dump \
  -U snackflow_user \
  -d snackflow \
  --no-owner \
  --no-acl \
  -f /tmp/snackflow_backup.sql

# Copiar el backup fuera del contenedor
docker cp snackflow-db:/tmp/snackflow_backup.sql ./database/backup.sql

# Subir a Neon
psql "$DATABASE_BACKUP_URL" < ./database/backup.sql

echo "Sincronización completada: $(date)"
