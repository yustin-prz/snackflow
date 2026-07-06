# SnackFlow POS — Contexto del proyecto

## Descripción
Sistema de punto de venta (POS) para **La Matamonchis S.A.**, empresa de venta de snacks en eventos masivos. Proyecto universitario de la UTN para el curso **ISW-1013 Calidad del Software**, II Cuatrimestre 2026.

## Stack tecnológico
| Capa | Tecnología |
|---|---|
| Frontend | HTML + CSS + JavaScript vanilla |
| Backend | Node.js + Express |
| Base de datos principal | Neon PostgreSQL (nube) con failover automático a PostgreSQL local |
| ORM | Sequelize |
| Pruebas | Jest + Supertest |
| Contenedores | Docker + Docker Compose |
| Repositorio | GitHub |
| Gestión | Azure DevOps (SCRUM) |
| Documentación | Swagger (api-docs) + JSDoc |
| Seguridad | Helmet + express-rate-limit + JWT + 2FA TOTP (Google Authenticator) |

## Estructura de carpetas
```
snackflow/
├── docker-compose.yml          # Orquesta los 3 contenedores
├── .env                        # Variables de entorno (NO subir a GitHub)
├── .env.example                # Plantilla de variables
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── index.js            # Punto de entrada — Express + Swagger + conexión BD
│   │   ├── config/
│   │   │   ├── database.js     # Conexión Sequelize con failover Neon → local
│   │   │   └── swagger.js      # Configuración OpenAPI 3.0
│   │   ├── models/
│   │   │   ├── index.js        # Inicializa modelos y relaciones (usar getModels())
│   │   │   ├── user.model.js   # Campos: id, username, password, full_name, role, active, totp_secret
│   │   │   ├── product.model.js
│   │   │   ├── sale.model.js
│   │   │   └── saleItem.model.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js      # POST /login, /setup-totp, /reset-password
│   │   │   ├── sales.routes.js
│   │   │   ├── products.routes.js
│   │   │   └── reports.routes.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── sales.controller.js
│   │   │   ├── products.controller.js
│   │   │   └── reports.controller.js
│   │   └── middlewares/
│   │       └── auth.middleware.js  # verifyToken, verifyAdmin
│   ├── services/
│   │   ├── auth.service.js         # Login, setupTotp, verifyTotpAndResetPassword
│   │   ├── totp.service.js         # generateSecret, generateQR, verifyToken
│   │   ├── sales.service.js
│   │   ├── discount.service.js     # Reglas HU-05
│   │   ├── promotion.service.js    # Reglas HU-06
│   │   ├── payment.service.js
│   │   └── report.service.js
│   └── tests/
│       ├── auth.test.js
│       ├── sales.test.js
│       ├── discount.test.js
│       └── promotion.test.js
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── pages/
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   └── pos.html            # En construcción
│   └── assets/
│       ├── css/
│       │   ├── main.css        # Estilos globales
│       │   ├── login.css
│       │   ├── dashboard.css
│       │   └── modal.css
│       └── js/
│           ├── api.js          # Wrapper fetch para llamadas al backend
│           ├── auth.js         # getToken, getUser, requireAuth, logout
│           ├── login.js        # login(), verifyTotp(), togglePassword()
│           ├── forgot-password.js  # Flujo recuperación con TOTP
│           └── dashboard.js
└── database/
    ├── init.sql                # Crea tablas e inserta 6 productos iniciales
    ├── migrations/
    └── sync-to-neon.sh         # Script manual de sincronización
```

## Variables de entorno (.env)
```env
DATABASE_URL=postgresql://snackflow_user:PASSWORD@db:5432/snackflow
DB_PASSWORD=PASSWORD
DATABASE_BACKUP_URL=postgresql://neondb_owner:PASSWORD@HOST/neondb?sslmode=require
PORT=3000
NODE_ENV=development
JWT_SECRET=clave_larga_minimo_32_caracteres
JWT_EXPIRES_IN=8h
```

## Cómo levantar el proyecto
```bash
docker compose up          # Levanta BD + backend + frontend
docker compose down        # Detiene todo
docker compose build --no-cache backend   # Reinstalar paquetes npm
```

## URLs
- Frontend: http://localhost:8080
- Backend API: http://localhost:3000
- Documentación Swagger: http://localhost:3000/api-docs
- Health check: http://localhost:3000/health

## Base de datos
### Tablas
- `users` — id, username, password (bcrypt), full_name, role (admin|cashier), active, totp_secret, created_at
- `products` — id, name, price, active
- `sales` — id, user_id, customer_name, subtotal, discount, tax, total, payment_method (cash|card), status (open|completed|cancelled), promotion, created_at
- `sale_items` — id, sale_id, product_id, quantity, unit_price, subtotal

### Productos iniciales
Papas (₡800), Bolis (₡500), Empanadas (₡1200), Gelatinas (₡500), Coca Cola (₡1000), Agua (₡600)

### Roles
- `admin` — acceso total incluyendo reportes y gestión de usuarios
- `cashier` — acceso solo al POS (ventas)

### Conexión
El backend intenta conectar a **Neon primero** (si hay internet). Si falla, usa **PostgreSQL local** (Docker). Esto está en `src/config/database.js` usando `getSequelize()` y `getModels()`.

## Autenticación
1. POST `/api/auth/login` con `{username, password}` → si el usuario tiene `totp_secret`, responde `{requireTotp: true}` (status 202)
2. El frontend muestra modal para ingresar código de 6 dígitos
3. POST `/api/auth/login` con `{username, password, totpToken}` → responde `{token, user}`
4. El token JWT se guarda en `localStorage` y se envía en el header `Authorization: Bearer {token}`
5. Rate limiting: máximo 5 intentos fallidos cada 15 minutos

## Historias de usuario y estado
| HU | Descripción | Estado | Fecha estimada |
|---|---|---|---|
| HU-01 | Ingreso seguro (Login + 2FA) | ✅ Completado | Lección 2 — 25 may |
| HU-02 | Nueva venta | 🔲 Pendiente | Lección 3 — 01 jun |
| HU-03 | Agregar artículo | 🔲 Pendiente | Lección 3 — 01 jun |
| HU-04 | Terminar venta | 🔲 Pendiente | Lección 4 — 08 jun |
| HU-05 | Ingresar descuento | 🔲 Pendiente | Lección 5 — 15 jun |
| HU-06 | Promoción 2x1 Gelatinas | 🔲 Pendiente | Lección 8 — 13 jul |
| HU-07 | Reportes | 🔲 Pendiente | Lección 9 — 20 jul |
| HU-08 | Gestión de usuarios (CRUD) | 🔲 Pendiente | Lección 3 — 01 jun |

## Reglas de negocio críticas
### HU-05 — Descuento manual
- Requiere al menos 3 productos **diferentes**
- Total de la venta debe ser ≥ ₡10,000
- Porcentaje máximo: 10%
- No aplica si ya hay una promoción activa (2x1)

### HU-06 — Promoción 2x1 Gelatinas
- Se aplica **automáticamente** al agregar 2 gelatinas
- Descuenta el precio de 1 gelatina completamente
- Se revierte automáticamente si se elimina una gelatina
- No aplica si ya hay un descuento manual activo

### Impuestos
- IVA: 13% sobre el subtotal

## Principios SOLID aplicados
- **S** — Cada servicio tiene una sola responsabilidad (auth.service, discount.service, promotion.service, etc.)
- **O** — Nuevas promociones se agregan sin modificar el código existente
- **D** — El backend depende de abstracciones (getModels()), no de la BD directamente

## Convención de commits
```
feat: nueva funcionalidad
fix: corrección de bug
test: agregar prueba
docs: documentación
refactor: mejora sin cambio funcional
```

## Equipo
| Nombre | Rol |
|---|---|
| Yustin Eduardo Pérez Castro | Líder |
| Kendal Barrios Calderón | Desarrollador |
| Eduardo Hernández Contreras | Desarrollador |

## Notas importantes
- **NUNCA** subir el `.env` a GitHub — el `.gitignore` ya lo protege
- Los modelos se inicializan con `initModels()` en `index.js` y se acceden con `getModels()` en los servicios
- El frontend usa **volumen en Docker** — los cambios en HTML/CSS/JS se ven al recargar el navegador sin rebuild
- El backend requiere rebuild (`docker compose build --no-cache backend`) cuando se agregan paquetes npm nuevos
- Swagger documenta todos los endpoints en `/api-docs` con comentarios JSDoc en las rutas
