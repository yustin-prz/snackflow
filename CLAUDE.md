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
│   │   │   ├── users.routes.js     # CRUD /api/users (solo admin)
│   │   │   ├── sales.routes.js
│   │   │   ├── products.routes.js
│   │   │   └── reports.routes.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── users.controller.js
│   │   │   ├── sales.controller.js
│   │   │   ├── products.controller.js
│   │   │   └── reports.controller.js
│   │   └── middlewares/
│   │       └── auth.middleware.js  # verifyToken, verifyAdmin
│   ├── services/
│   │   ├── auth.service.js         # Login, changeTempPassword, setupTotp, verifyTotpAndResetPassword
│   │   ├── users.service.js        # CRUD de usuarios, activar/desactivar, contraseña temporal
│   │   ├── email.service.js        # Envío de contraseña temporal por correo (nodemailer/Gmail)
│   │   ├── totp.service.js         # generateSecret, generateQR, buildOtpauthUrl, verifyToken
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
│   │   ├── users.html          # Gestión de usuarios (solo admin)
│   │   └── pos.html            # En construcción
│   └── assets/
│       ├── css/
│       │   ├── main.css        # Estilos globales
│       │   ├── login.css
│       │   ├── dashboard.css
│       │   ├── users.css
│       │   └── modal.css
│       └── js/
│           ├── api.js          # Wrapper fetch para llamadas al backend (get/post/put/del)
│           ├── auth.js         # getToken, getUser, requireAuth, requireAdmin, logout
│           ├── login.js        # login(), verifyTotp(), togglePassword()
│           ├── forgot-password.js  # Flujo recuperación con TOTP
│           ├── dashboard.js
│           └── users.js        # Listar, crear, editar y desactivar usuarios
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
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_contrasena_de_aplicacion
MAIL_FROM=SnackFlow POS <tu_correo@gmail.com>
```
`SMTP_USER`/`SMTP_PASS` son de una cuenta de Gmail con "contraseña de aplicación" (no la contraseña normal de la cuenta). Sin esto configurado, `POST /api/users` falla al crear usuarios (ver sección de creación de usuarios más abajo).

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
- `users` — id, username, email, password (bcrypt), full_name, role (admin|cashier), active, totp_secret, totp_confirmed, totp_setup_deadline, must_change_password, created_at
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

### Onboarding de usuarios nuevos (contraseña temporal + 2FA obligatorio)
El admin **nunca define ni ve la contraseña** de un usuario nuevo. Al crear desde el CRUD (`POST /api/users`, sin campo `password`), `users.service.js`:
1. Genera una contraseña temporal aleatoria (`generateTempPassword()`) y la envía por correo con `email.service.js` (nodemailer + Gmail SMTP, credenciales en `.env`). Si el envío falla, se revierte la creación (no queda un usuario huérfano) y se devuelve el error de SMTP.
2. Genera igual el `totp_secret` (2FA obligatorio) y marca `must_change_password: true`.

Flujo de primer login (todo en `auth.service.js` / `login.js`):
1. Usuario entra con su usuario + contraseña temporal → como `must_change_password` es `true`, el login responde 202 `{mustChangePassword: true}` **sin pedir 2FA todavía**.
2. El frontend abre un modal: nueva contraseña, confirmar nueva contraseña, y la contraseña temporal de nuevo (para confirmar identidad) → `POST /api/auth/change-temp-password`. Esto pone `must_change_password: false`.
3. El frontend reintenta el login automáticamente con la contraseña nueva. Como el 2FA todavía no está confirmado, ahora sí responde 202 `{requireTotp: true, pendingSetup: true, qrCode, secret, deadline}` — el QR se muestra directo en el mismo modal de login (no hace falta que el admin lo muestre).
4. El usuario escanea el QR e ingresa el código de 6 dígitos → login exitoso, `totp_confirmed: true`.

Columnas relevantes en `users`: `must_change_password`, `totp_confirmed` (se pone en `true` recién en el primer login exitoso con código válido) y `totp_setup_deadline` (creado + 24h). Si pasa la fecha límite sin confirmar el 2FA, `auth.service.js` desactiva la cuenta automáticamente en el próximo intento de login (`active = false`). Cuando un admin reactiva a alguien que nunca confirmó su 2FA (`PATCH /api/users/:id/status`), se le da una nueva ventana de 24h y puede volver a ver el QR con `GET /api/users/:id/qr` (por si el correo se perdió).

Cuando un admin resetea la contraseña de alguien desde "Editar" (`PUT /api/users/:id`, campo `password` opcional), esa queda como contraseña definitiva — no fuerza `must_change_password` (a diferencia de la creación).

### Activar / desactivar usuarios
`PATCH /api/users/:id/status` con `{active, totpToken}` — requiere el código de Google Authenticator **del administrador que ejecuta la acción** (no del usuario objetivo), y nunca se puede aplicar sobre el propio usuario autenticado. El frontend (`users.js`) siempre pide confirmación + código antes de llamar este endpoint, tanto para activar como para desactivar.

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
| HU-08 | Gestión de usuarios (CRUD) | ✅ Completado | Lección 3 — 01 jun |

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
- No hay `sequelize.sync()` — el esquema de BD se gestiona a mano con `database/init.sql` (instalación nueva) y `database/migrations/*.sql` (cambios sobre una BD existente). Si ya tenías el proyecto corriendo, ejecutá en orden `001_add_email_to_users.sql`, `002_add_totp_confirmation.sql` y `003_add_must_change_password.sql` contra tu BD local y Neon.
- Si agregás una dependencia nueva al backend (`package.json`), `docker compose build backend` no alcanza — el volumen anónimo `/app/node_modules` puede quedar con la versión vieja. Usá `docker compose up -d --force-recreate --renew-anon-volumes backend` después de buildear.
- **NUNCA** subir el `.env` a GitHub — el `.gitignore` ya lo protege
- Los modelos se inicializan con `initModels()` en `index.js` y se acceden con `getModels()` en los servicios
- El frontend usa **volumen en Docker** — los cambios en HTML/CSS/JS se ven al recargar el navegador sin rebuild
- El backend requiere rebuild (`docker compose build --no-cache backend`) cuando se agregan paquetes npm nuevos
- Swagger documenta todos los endpoints en `/api-docs` con comentarios JSDoc en las rutas
