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
│   │   │   ├── sales.routes.js     # Encabezado de venta (POST /, GET /, PATCH /:id/complete)
│   │   │   ├── saleItem.routes.js  # Detalle de venta: /api/sales/:saleId/items, /api/sales/items/:itemId
│   │   │   ├── products.routes.js
│   │   │   └── reports.routes.js   # /by-transaction, /by-product, /by-user (solo admin)
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── users.controller.js
│   │   │   ├── sale.controller.js
│   │   │   ├── saleItem.controller.js
│   │   │   ├── products.controller.js  # CRUD real (borrado físico) + imagen base64
│   │   │   └── reports.controller.js
│   │   └── middlewares/
│   │       └── auth.middleware.js  # verifyToken, verifyAdmin
│   ├── services/
│   │   ├── auth.service.js         # Login, changeTempPassword, setupTotp, verifyTotpAndResetPassword
│   │   ├── users.service.js        # CRUD de usuarios, activar/desactivar, contraseña temporal
│   │   ├── email.service.js        # Envío de contraseña temporal por correo (nodemailer/Gmail)
│   │   ├── totp.service.js         # generateSecret, generateQR, buildOtpauthUrl, verifyToken
│   │   ├── products.service.js     # CRUD de productos, borrado físico, manejo de imagen base64
│   │   ├── sale.service.js         # Encabezado de venta: create, recalculateSale, complete
│   │   ├── saleItem.service.js     # Detalle: addItem/updateItem/removeItem (dispara recalculateSale)
│   │   ├── discount.service.js     # Reglas HU-05
│   │   ├── promotion.service.js    # Reglas HU-06
│   │   ├── payment.service.js
│   │   └── report.service.js       # Agregaciones de ventas: byTransaction, byProduct, byUser
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
│   │   ├── products.html       # Catálogo de productos (lectura: todos, escritura: admin)
│   │   ├── nuevaVenta.html     # Wizard de venta: cliente → pedido → resumen/cobro (HU-02/03/04)
│   │   └── reports.html        # Gráficos + descarga Excel (solo admin, HU-07)
│   └── assets/
│       ├── css/
│       │   ├── main.css        # Estilos globales
│       │   ├── login.css
│       │   ├── dashboard.css
│       │   ├── users.css
│       │   ├── products.css
│       │   ├── nuevaVenta.css
│       │   ├── reports.css
│       │   └── modal.css
│       └── js/
│           ├── api.js          # Wrapper fetch para llamadas al backend (get/post/put/patch/del)
│           ├── auth.js         # getToken, getUser, requireAuth, requireAdmin, logout
│           ├── theme.js        # Alterna modo claro/oscuro (persistido en localStorage)
│           ├── login.js        # login(), verifyTotp(), togglePassword()
│           ├── forgot-password.js  # Flujo recuperación con TOTP
│           ├── dashboard.js
│           ├── users.js        # Listar, crear, editar, activar/desactivar usuarios
│           ├── products.js     # Listar, crear, editar, eliminar productos + carga de imagen
│           ├── nuevaVenta.js   # Wizard de venta, llama POST /sales → POST /sales/:id/items → PATCH /sales/:id/complete
│           └── reports.js      # Fetch a /api/reports/*, gráficos (Chart.js CDN) y descarga del Excel (GET /api/reports/export)
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
- `products` — id, name, price, active, image (TEXT, data URL base64 completo o NULL)
- `sales` — id, user_id, customer_name, customer_phone, notes, subtotal, discount, tax, total, payment_method (cash|card), status (open|completed|cancelled), promotion, created_at
- `sale_items` — id, sale_id, product_id, quantity, unit_price, subtotal

### Productos iniciales
Papas (₡800), Bolis (₡500), Empanadas (₡1200), Gelatinas (₡500), Coca Cola (₡1000), Agua (₡600)

### CRUD de productos (a diferencia de usuarios, es borrado físico)
`products.service.js`: `remove(id)` hace `DELETE FROM products` real, no borrado lógico. Si el producto tiene `sale_items` asociados, Postgres rechaza el `DELETE` por la foreign key (`sale_items.product_id → products.id`, sin `ON DELETE CASCADE`) y el servicio traduce ese error a "No se puede eliminar el producto: tiene ventas asociadas."

La imagen se guarda como **data URL base64 completo** (`data:image/png;base64,...`) en la columna `image` (TEXT), no como archivo:
- `POST/PUT /api/products` reciben `image` como ese mismo string, lo validan (formato + máximo 3MB decodificado) en `parseDataUrl()`.
- `GET /api/products` (listado) NO incluye la imagen, solo `hasImage: boolean` — para no inflar el payload de la lista.
- `GET /api/products/:id` sí incluye la imagen completa (útil para precargarla en el form de edición).
- `GET /api/products/:id/image` decodifica el base64 y devuelve el binario real con el `Content-Type` correcto (`image/png`, `image/jpeg`, etc.) — **este endpoint es público** (sin `verifyToken`) porque una etiqueta `<img src="...">` no puede mandar el header `Authorization`; el frontend lo usa directo como `src` de la imagen.
- El límite de `express.json()` en `src/index.js` se subió a `5mb` para admitir el base64 en el body (por defecto Express permite apenas 100kb).

### Flujo de ventas (Nueva venta / HU-02, HU-03, HU-04)
El wizard de `nuevaVenta.html`/`nuevaVenta.js` (3 pasos: cliente → pedido → resumen) llama a la API real en la confirmación:
1. `POST /api/sales` — crea el encabezado en estado `open`. El `user_id` **siempre se toma del token** (`req.user.id` en `sale.controller.js`), nunca del body — así un cajero no puede crear una venta a nombre de otro usuario.
2. `POST /api/sales/{saleId}/items` — uno por cada producto del carrito. Si el producto ya estaba en la venta, suma la cantidad en vez de duplicar la fila. Rechaza productos con `active: false` (`saleItem.service.js`). Cada `addItem`/`updateItem`/`removeItem` dispara `sale.service.js` → `recalculateSale()`, que recalcula `subtotal`/`tax` (13% IVA)/`total` desde cero a partir de los `sale_items` actuales (redondeado a 2 decimales con `round2()`).
3. `PATCH /api/sales/{id}/complete` con `{payment_method: 'cash'|'card'}` — cierra la venta (`status: 'completed'`). Falla si la venta no tiene productos o ya está cerrada. El frontend mapea `efectivo → cash` y `tarjeta → card` antes de mandarlo.

Todas las rutas de `/api/sales/*` requieren `verifyToken` (antes no lo tenían — se agregó junto con el resto de estas correcciones). Si algún paso falla a mitad del flujo (por ejemplo se cae la red después de crear la venta pero antes de cerrarla), la venta queda huérfana en estado `open` — no hay rollback automático; hay que revisarla manualmente o desde un futuro panel de ventas abiertas.

### Dashboard: ventas de hoy vs. estadísticas semanales
`dashboard.js` → `loadSalesStats()` trae `GET /api/sales` (todas) y separa dos cosas con criterios de fecha distintos:
- Las 4 tarjetas de arriba ("Ventas esta semana", "Total recaudado", "Efectivo", "Tarjeta") usan `isThisWeek()` — semana calendario actual, lunes 00:00 hasta ahora — y solo cuentan ventas `status: 'completed'`.
- La tabla "Ventas de hoy" usa `isToday()`, muestra las últimas 10 (cualquier estado, no solo completadas).

### Reportes (HU-07): gráficos + Excel
`reports.html`/`reports.js`, solo admin (`auth.requireAdmin()` + backend `verifyAdmin`). Filtro de fechas (`from`/`to`, default últimos 30 días) dispara `loadReports()`, que llama en paralelo los 3 endpoints de `report.service.js`:
- `GET /api/reports/by-transaction` — ventas completadas del rango, con el cajero (`User`) incluido. Es la base de la tabla de detalle y de la hoja "Transacciones" del Excel.
- `GET /api/reports/by-product` — `sale_items` del rango agregados por producto (cantidad + ingresos), ordenado desc.
- `GET /api/reports/by-user` — ventas del rango agregadas por cajero (cantidad + ingresos), ordenado desc.

Gráficos con **Chart.js** (CDN, `chart.js@4.4.4`) — ventas por día (barra, un color), método de pago (barra apilada horizontal, 2 categorías: es un part-to-whole, no un pie chart), ventas por cajero y top de productos (barras horizontales rankeadas). Los colores de las series están en `PALETTE` (`reports.js`), una paleta categórica validada con el script `validate_palette.js` del skill de dataviz (separación CVD, contraste, banda de luminosidad) — separada para modo claro/oscuro. Como un `<canvas>` no puede resolver `var(--x)`, los gráficos se destruyen y re-crean con los hex correctos cada vez que cambia `data-theme` (via `MutationObserver` sobre `<html>`).

El botón "Descargar Excel" pega a `GET /api/reports/export` (mismo `from`/`to` del filtro), que arma el `.xlsx` **en el servidor** con **ExcelJS** (`reportExcel.service.js`) y lo devuelve como archivo binario — el frontend solo hace `fetch` + `blob()` + un link temporal para disparar la descarga (necesita mandar el `Authorization` a mano, no puede ser un `<a href>` directo). Se probó con ExcelJS que el .xlsx generado es válido leyéndolo de vuelta con la misma librería.

Por qué en el backend y no en el navegador: la librería de Excel para navegador (SheetJS gratuita) **no soporta estilos** (colores, bordes, tablas) — solo la versión paga los tiene. ExcelJS sí es gratis y con estilos completos, pero es una librería de Node, no de navegador, así que tiene que vivir en el backend.

Formato del archivo (4 hojas):
- **Resumen** — encabezado con el gradiente dorado de marca, KPIs con formato de moneda.
- **Transacciones** — es una **Tabla de Excel real** (`worksheet.addTable()`, no solo texto): filas en franjas, filtros en cada columna, encabezado congelado. Es la hoja pensada para que alguien arme su propia tabla dinámica (Insertar → Tabla dinámica) — generar una tabla dinámica *nativa* de Excel desde JS no es viable de forma confiable con las librerías disponibles, así que en vez de eso se entrega la mejor fuente posible para armarla a mano en segundos.
- **Productos** y **Cajeros** — mismo tratamiento de tabla, con un estilo de Excel distinto (`TableStyleMedium7`) para diferenciarlas visualmente de "Transacciones".

### Roles
- `admin` — acceso total incluyendo reportes, gestión de usuarios y CRUD completo de productos
- `cashier` — acceso al POS (ventas) y solo lectura del catálogo de productos

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
| HU-02 | Nueva venta | ✅ Completado | Lección 3 — 01 jun |
| HU-03 | Agregar artículo | ✅ Completado | Lección 3 — 01 jun |
| HU-04 | Terminar venta | ✅ Completado | Lección 4 — 08 jun |
| HU-05 | Ingresar descuento | 🔲 Pendiente | Lección 5 — 15 jun |
| HU-06 | Promoción 2x1 Gelatinas | 🔲 Pendiente | Lección 8 — 13 jul |
| HU-07 | Reportes | ✅ Completado | Lección 9 — 20 jul |
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
- No hay `sequelize.sync()` — el esquema de BD se gestiona a mano con `database/init.sql` (instalación nueva) y `database/migrations/*.sql` (cambios sobre una BD existente). Si ya tenías el proyecto corriendo, ejecutá en orden `001_add_email_to_users.sql`, `002_add_totp_confirmation.sql`, `003_add_must_change_password.sql`, `004_add_image_to_products.sql` y `005_add_customer_details_to_sales.sql` contra tu BD local y Neon.
- Si agregás una dependencia nueva al backend (`package.json`), `docker compose build backend` no alcanza — el volumen anónimo `/app/node_modules` puede quedar con la versión vieja. Usá `docker compose up -d --force-recreate --renew-anon-volumes backend` después de buildear.
- **NUNCA** subir el `.env` a GitHub — el `.gitignore` ya lo protege
- Los modelos se inicializan con `initModels()` en `index.js` y se acceden con `getModels()` en los servicios
- El frontend usa **volumen en Docker** — los cambios en HTML/CSS/JS se ven al recargar el navegador sin rebuild
- El backend requiere rebuild (`docker compose build --no-cache backend`) cuando se agregan paquetes npm nuevos
- Swagger documenta todos los endpoints en `/api-docs` con comentarios JSDoc en las rutas
