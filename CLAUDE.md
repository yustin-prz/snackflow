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
│   │   │   ├── auth.routes.js      # POST /login, /setup-totp, /check-user, /reset-password
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
- `sales` — id, user_id, customer_name, customer_phone, notes, subtotal, discount, discount_percentage, tax, total, payment_method (cash|card), status (open|completed|cancelled), promotion, created_at
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
- **Cache-busting de la imagen**: como `GET /api/products/:id/image` se cachea en el navegador pero su URL no cambia cuando se reemplaza la foto, `products.service.js` calcula `imageVersion` (hash MD5 del contenido, primeros 10 caracteres) y lo manda en `hasImage`/el detalle del producto. El frontend lo agrega como `?v={imageVersion}` al pedir la imagen (`products.js`, `nuevaVenta.js`), forzando al navegador a pedir la versión nueva en vez de seguir mostrando la vieja cacheada.

### Flujo de ventas (Nueva venta / HU-02, HU-03, HU-04)
El wizard de `nuevaVenta.html`/`nuevaVenta.js` tiene **2 pasos** (Pedido → Resumen; el paso de "Cliente" que existía antes se eliminó). Llama a la API real al confirmar:
1. `POST /api/sales` — crea el encabezado en estado `open`. El `user_id` **siempre se toma del token** (`req.user.id` en `sale.controller.js`), nunca del body — así un cajero no puede crear una venta a nombre de otro usuario. `customer_name` se manda solo si el cajero activó el toggle de "Factura electrónica" (ver abajo); `customer_phone`/`notes` siempre van `null` — esos campos de la BD ya no los llena esta pantalla.
2. `POST /api/sales/{saleId}/items` — uno por cada producto del carrito. Si el producto ya estaba en la venta, suma la cantidad en vez de duplicar la fila. Rechaza productos con `active: false` (`saleItem.service.js`). Cada `addItem`/`updateItem`/`removeItem` dispara `sale.service.js` → `recalculateSale()`, que recalcula `subtotal`/`tax` (13% IVA)/`total` **y mantiene coherente el descuento/promoción activo** (ver sección de HU-05/HU-06) a partir de los `sale_items` actuales (redondeado a 2 decimales con `round2()`).
3. Si el cajero aplicó un descuento manual, `POST /api/sales/{id}/discount` antes de cerrar (ver HU-05).
4. `PATCH /api/sales/{id}/complete` con `{payment_method: 'cash'|'card'}` — cierra la venta (`status: 'completed'`). Falla si la venta no tiene productos o ya está cerrada. El frontend mapea `efectivo → cash` y `tarjeta → card` antes de mandarlo.

Todas las rutas de `/api/sales/*` requieren `verifyToken`, sin restricción de rol — un cajero puede hacer todo esto (crear venta, aplicar descuento, cerrar). Si algún paso falla a mitad del flujo (por ejemplo se cae la red después de crear la venta pero antes de cerrarla), la venta queda huérfana en estado `open` — no hay rollback automático; hay que revisarla manualmente o desde un futuro panel de ventas abiertas.

**Efectivo recibido / vuelto**: si el método de pago es efectivo, el frontend (`nuevaVenta.js`) exige un monto recibido ≥ al total antes de dejar confirmar, y muestra el vuelto calculado (`actualizarVuelto()`) — esto es solo de cara al cajero, el backend no guarda el monto recibido ni el vuelto en ningún lado.

**Factura electrónica**: toggle opcional en el resumen que pide nombre (opcional) y correo (obligatorio si el toggle está activo — se valida en `nuevaVenta.js` con un regex simple antes de dejar confirmar). Ambos se mandan en `POST /api/sales` (`customer_name`/`customer_email`, columna nueva en `sales`, migración `007_add_customer_email_to_sales.sql`).

Al cerrar la venta (`PATCH /api/sales/:id/complete`), si la venta tiene `customer_email`, `sale.service.js` arma el detalle completo (`getById()`) y llama a `emailService.sendInvoice()` (`email.service.js`) con el resumen de la compra: items con precio unitario/cantidad/importe, subtotal, descuento (manual o 2x1, con su etiqueta), IVA, total, método de pago, cajero y fecha — mismo diseño de tabla que usa la app (Producto/Precio unitario/Cant./Importe), con la identidad visual de La Matamonchis (degradé dorado, logo). El correo lleva dos adjuntos:
- **PDF** (`invoicePdf.service.js`, con `pdfkit` — sin dependencias nativas, a diferencia de opciones basadas en Chromium) con el mismo desglose, pensado para guardar/imprimir.
- **XML de demostración** (`invoiceXml.service.js`) con la forma de un **Tiquete Electrónico v4.4** de Hacienda Costa Rica (no `FacturaElectronica`: un Tiquete es el tipo correcto para venta a consumidor final sin pedirle la cédula, que es el caso de esta app) — es solo para mostrar el formato en la demo del proyecto.

**Ninguno de los dos es un comprobante electrónico autorizado por el Ministerio de Hacienda.** Ser un emisor real de comprobantes electrónicos en Costa Rica exige: estar registrado como contribuyente, tener códigos CABYS reales por producto, y sobre todo **firmar el XML con un certificado digital emitido por la CA de Hacienda** (nodo `<ds:Signature>`, firma XAdES-BES) y transmitirlo a su API — nada de eso está ni va a estar implementado acá, es un fraude firmar algo así sin un certificado real. Por eso el XML **deliberadamente no incluye `<ds:Signature>`** (el schema real lo exige) y usa placeholders obvios (ceros/nueves) en `Clave`, cédula, código de actividad y CABYS — todo documentado en un comentario al inicio del propio archivo XML. El PDF también aclara en el pie que es un comprobante interno, no fiscal.

El envío es **best-effort y no bloqueante**: la venta ya está cobrada y cerrada para cuando se intenta mandar el correo, así que un fallo de SMTP nunca revierte ni falla la venta — solo se refleja en la respuesta (`invoiceEmailSent`/`invoiceEmailError`), y el frontend se lo avisa al cajero en el mensaje de confirmación ("no se pudo enviar, avisale al cliente a mano").

**Ojo con las fechas — el contenedor del backend corre en UTC, no en hora de Costa Rica (UTC-6)**: cualquier `toLocaleString('es-CR', ...)` que se ejecute en el backend (no en el navegador del cliente, que sí usa su zona horaria local) necesita `timeZone: 'America/Costa_Rica'` explícito, o el texto sale con 6 horas de más. Ya pasó una vez: la fecha del PDF/correo de una compra hecha a las 7:01am decía la 1:01pm. Arreglado en `email.service.js` e `invoicePdf.service.js` (y en `reportExcel.service.js`, que tenía el mismo bug en la columna "Fecha" del Excel). Si se agrega otro lugar que formatee `created_at` en el backend, hay que acordarse de este detalle.

### Descuento manual y promoción 2x1 (HU-05, HU-06)
Implementadas en `sale.service.js`. Son **mutuamente excluyentes** — nunca hay un descuento manual y la 2x1 activos al mismo tiempo — y ambas se recalculan solas cada vez que cambia el carrito, dentro de `recalculateSale()`:
- Si la venta tiene un descuento **manual** (`promotion: 'manual'`), se revalida en cada recálculo: si deja de cumplir los requisitos (menos de 3 productos distintos o total < ₡10,000), se quita solo.
- Si no hay descuento manual, se evalúa la promo **2x1 de Gelatina** (`_calcularPromo2x1()`): por cada par de unidades de un producto cuyo nombre contenga "gelatina" (insensible a mayúsculas), se descuenta el precio de una unidad. 4 gelatinas = 2 pares = se descuentan 2; 3 gelatinas = 1 par = se descuenta 1. Se aplica y se quita sola según el carrito, sin que el cajero haga nada.
- Los precios de producto **ya incluyen IVA**: el total se calcula como `suma de productos − descuento`, y de ese total final (con IVA incluido) recién se desglosan `subtotal` e `tax` — mismo criterio en frontend (`nuevaVenta.js` → `totales()`) y backend, para que lo que ve el cajero coincida centavo a centavo con lo que se guarda.

Endpoints (`sales.routes.js`, sin restricción de rol):
- `POST /api/sales/{id}/discount` con `{percentage}` — aplica un descuento manual. Valida (de nuevo, en el servidor — la del frontend es solo UX) que haya ≥3 productos distintos, total ≥ ₡10,000, porcentaje ≤10%, y que no haya otra promoción activa.
- `DELETE /api/sales/{id}/discount` — quita el descuento/promoción activo y recalcula (lo que reactiva la 2x1 sola si el carrito todavía califica).

**Ojo con esto si se rompe de nuevo**: el porcentaje del descuento se guarda en la columna `discount_percentage` de `sales` (necesaria para poder recalcular el monto en colones cada vez que cambia el carrito, sin perder el % original). Este campo se agregó al modelo legado `sale.model.js` pero al principio **no** se agregó a `src/models/index.js` (el que Sequelize usa de verdad vía `getModels()`) ni tenía migración — eso hacía que el descuento se aplicara bien la primera vez pero **desapareciera solo** en cuanto se agregaba/quitaba cualquier producto después (el `%` nunca se releía del modelo, así que `recalculateSale()` lo trataba como si no hubiera descuento). Ya está arreglado (migración `006_add_discount_percentage_to_sales.sql` + el campo agregado a `src/models/index.js`) y probado: el descuento ahora sobrevive a agregar más productos. Si algún día se agrega OTRO campo nuevo a `sale.model.js`, hay que agregarlo también a `src/models/index.js` — son dos definiciones de modelo separadas y solo la segunda está en uso.

### Dashboard: ventas de hoy vs. estadísticas semanales
`dashboard.js` → `loadSalesStats()` trae `GET /api/sales` (todas) y separa dos cosas con criterios de fecha distintos:
- Las 4 tarjetas de arriba ("Ventas esta semana", "Total recaudado", "Efectivo", "Tarjeta") usan `isThisWeek()` — semana calendario actual, lunes 00:00 hasta ahora — y solo cuentan ventas `status: 'completed'`.
- La tabla "Ventas de hoy" usa `isToday()`, muestra las últimas 10 (cualquier estado, no solo completadas).

**Ver/imprimir factura desde el dashboard**: en cada venta `completed` de la tabla, junto a la hora hay un botón `⋮` (`.row-menu`) con dos opciones — "Ver factura" e "Imprimir factura" (`abrirFactura()` en `dashboard.js`). No hay endpoint ni archivo nuevo: reutiliza `GET /api/sales/:id` (el mismo que ya usaba el resto de la app) y arma el detalle en un modal HTML (`#invoice-modal`, mismo contenido/orden que el PDF de la factura: cliente, correo, fecha, cajero, método de pago, items, subtotal/descuento/IVA/total). "Imprimir" no manda nada a ningún lado — solo llama a `window.print()` sobre ese mismo modal; el `@media print` en `dashboard.css` esconde el resto de la página y solo deja visible `#invoice-print-area`. Se decidió así (en vez de descargar un PDF) para no tener que generar ni guardar ningún archivo — la info ya vive en `sales`/`sale_items`.

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
- `admin` — acceso total: reportes, gestión de usuarios, y CRUD completo de productos (incluyendo eliminar)
- `cashier` — puede crear ventas (Nueva venta) y agregar/editar productos (`POST`/`PUT /api/products`, sin `verifyAdmin`); **no** puede eliminar productos (`DELETE` sigue exigiendo `verifyAdmin`), ni entrar a usuarios o reportes

### Conexión
El backend intenta conectar a **Neon primero** (si hay internet). Si falla, usa **PostgreSQL local** (Docker). Esto está en `src/config/database.js` usando `getSequelize()` y `getModels()`.

**Failover en vivo, no solo al arrancar**: `connectDB()` corre una vez al iniciar el contenedor, pero además `startHealthCheck()` (llamada desde `index.js`, cada 20s) revisa la conexión activa todo el tiempo que el backend sigue corriendo. Si Neon se cae a mitad de una sesión (no solo si ya estaba caído al arrancar), pasa sola a Postgres local; y si estando en local Neon vuelve a responder, reconecta sola a Neon. Cada cambio de lado vuelve a correr `initModels()`, porque los modelos de Sequelize quedan atados a la instancia de conexión con la que se definieron — si no se rehacen, seguirían apuntando a la conexión vieja aunque el singleton `sequelize` ya haya cambiado. `GET /health` devuelve `database: "neon"|"local"` para poder confirmar de un vistazo dónde está parado.

**Sincronización automática local → Neon (solo ventas)**: cuando `startHealthCheck()` detecta que se volvió de local a Neon, además de `initModels()` corre `dbSync.service.js` → `syncPendingSales()`, que sube a Neon las ventas que se hayan creado mientras el backend estaba sobre Postgres local.

Cómo se marca qué falta subir: `sales.synced_to_neon` (migración `008_add_sync_tracking_to_sales.sql`, columna presente en ambas bases). Un hook `Sale.beforeCreate` (`src/models/index.js`) marca `synced_to_neon: false` si en ese momento `getActiveSource() === 'local'`; en Neon todo se crea ya con `true` (nada que sincronizar). Al sincronizar, cada venta pendiente se inserta en Neon con un **id nuevo** (no se reutiliza el id local, para no chocar con lo que Neon ya tenga asignado) dentro de una transacción, sus `sale_items` se remapean a ese id nuevo, y recién si todo sale bien se marca `synced_to_neon: true` en local. Si una venta falla al subir (ej. un producto que se creó nuevo estando en local y no existe en Neon), se corta ahí — no sigue con las siguientes, para no dejar el orden a medias — y se reintenta sola en la próxima reconexión.

**Qué NO cubre esto, a propósito**:
- **`users` queda completamente afuera.** Mete contraseñas y secretos de 2FA — fusionar cuentas creadas en dos bases distintas sin supervisión humana es un riesgo de seguridad real, no algo para automatizar a la ligera.
- **`products` también queda afuera.** Se asume que los productos existentes están replicados 1:1 entre local y Neon (mismo id en ambas — las dos parten del mismo `init.sql`/migraciones). Si se crea un producto nuevo estando en local y después se vende, esa venta puntual va a fallar al sincronizar (el `product_id` no existe en Neon) y se queda pendiente hasta que alguien lo resuelva a mano.
- `user_id`/`product_id` de las ventas sincronizadas se asumen válidos en Neon por la misma razón (usuarios/productos ya existentes, no creados durante el corte).
- `database/sync-to-neon.sh` (dump completo, manual, unidireccional) sigue existiendo como último recurso para reconciliar usuarios/productos si de verdad llegan a divergir entre las dos bases — pero no resuelve conflictos de ID, así que hay que revisar a mano antes de correrlo.

Probado de punta a punta: se insertó una venta directo en Postgres local con `synced_to_neon = false`, se corrió `syncPendingSales()` a mano, y apareció en Neon con un id nuevo y su `sale_item` remapeado correctamente; correrlo una segunda vez no hizo nada (0 pendientes, idempotente).

## Autenticación
1. POST `/api/auth/login` con `{username, password}` → si el usuario tiene `totp_secret`, responde `{requireTotp: true}` (status 202)
2. El frontend muestra modal para ingresar código de 6 dígitos
3. POST `/api/auth/login` con `{username, password, totpToken}` → responde `{token, user}`
4. El token JWT se guarda en `localStorage` y se envía en el header `Authorization: Bearer {token}`
5. Rate limiting: máximo 5 intentos fallidos cada 15 minutos, **por IP + usuario** (`auth.routes.js`, `porIpYUsuario`). Antes era solo por IP: en un local con una sola red/router, todos los cajeros comparten la IP que ve el servidor, así que 5 intentos fallidos de un cajero bloqueaba el login de TODOS los demás durante 15 minutos. Mismo criterio aplicado a `resetLimiter` y `changePasswordLimiter`.

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

### Recuperar contraseña ("olvidé mi contraseña", sin sesión)
`forgot-password.js` → paso 1 pide el usuario y llama `POST /api/auth/check-user` (público, con `resetLimiter`) para confirmar que existe y tiene 2FA configurado, antes de dejarlo avanzar al paso del código TOTP + nueva contraseña (`POST /api/auth/reset-password`). **Antes este paso 1 llamaba por error a `/api/auth/setup-totp`** — un endpoint que exige `verifyToken`, imposible de tener si justo estás recuperando el acceso — así que la recuperación de contraseña estaba completamente rota (siempre fallaba con 401) hasta que se agregó `check-user`/`userExists()` (`auth.service.js`) para reemplazarlo.

### Activar / desactivar usuarios
`PATCH /api/users/:id/status` con `{active, totpToken}` — requiere el código de Google Authenticator **del administrador que ejecuta la acción** (no del usuario objetivo), y nunca se puede aplicar sobre el propio usuario autenticado. El frontend (`users.js`) siempre pide confirmación + código antes de llamar este endpoint, tanto para activar como para desactivar.

## Diseño responsive (celular / tablet)
Se agregó soporte completo para pantallas chicas, en `main.css` + `theme.js`:
- **Menú de usuario en hamburguesa** (`#menu-toggle` / `#header-menu`): en celular, el nombre/rol/"Cerrar sesión" del header se esconden detrás de un botón ☰ (`toggleHeaderMenu()` en `theme.js`) — se abre con clic, se cierra con clic afuera o `Escape`. En tablet/desktop `.header-menu` se muestra inline como siempre (es puro CSS, la media query decide). Todas las páginas con header (`dashboard.html`, `users.html`, `products.html`, `reports.html`, `nuevaVenta.html`) tienen esta misma estructura — si se agrega una página nueva con header, hay que copiar el mismo patrón de `#menu-toggle`/`#header-menu` o el menú no va a colapsar en celular.
- **Tablas → tarjetas en celular/tablet** (`table.mobile-cards`, por debajo de 900px): cada `<tr>` se convierte en una tarjeta y cada `<td>` se apila con su encabezado como etiqueta, vía `content: attr(data-label)`. Esto requiere que el JS que arma las filas le ponga `data-label="..."` a cada `<td>` (ya lo hacen `dashboard.js`, `users.js`, `reports.js`). Si se agrega una tabla nueva y se le pone la clase `mobile-cards`, hay que acordarse de poner `data-label` en cada celda o va a salir sin la etiqueta.
- **Contraste de colores corregido**: varios tonos originales (texto muted, badges de estado en oscuro, degradé del header en oscuro) no llegaban al mínimo WCAG AA (4.5:1 texto normal / 3:1 elementos grandes) — están documentados con el contraste real medido en comentarios dentro de `main.css`, junto a los valores nuevos.
- **Cache-Control del frontend**: `nginx.conf` ahora manda `Cache-Control: no-store, no-cache, must-revalidate` en todas las rutas — antes el navegador podía quedarse con una versión vieja de un `.html`/`.js`/`.css` cacheada varios días (heurística por defecto de Chrome) y los cambios no se veían ni recargando la página. Es la causa raíz de al menos un caso ya visto en el proyecto (un link que caía en una página que "no existía" y el navegador servía una versión cacheada de otra).

## Historias de usuario y estado
| HU | Descripción | Estado | Fecha estimada |
|---|---|---|---|
| HU-01 | Ingreso seguro (Login + 2FA) | ✅ Completado | Lección 2 — 25 may |
| HU-02 | Nueva venta | ✅ Completado | Lección 3 — 01 jun |
| HU-03 | Agregar artículo | ✅ Completado | Lección 3 — 01 jun |
| HU-04 | Terminar venta | ✅ Completado | Lección 4 — 08 jun |
| HU-05 | Ingresar descuento | ✅ Completado | Lección 5 — 15 jun |
| HU-06 | Promoción 2x1 Gelatinas | ✅ Completado | Lección 8 — 13 jul |
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

### Denominaciones de moneda (₡5)
En Costa Rica no existen monedas/billetes fraccionarios: las denominaciones (₡10, ₡25, ₡50, ₡100, ₡500, ...) son todas múltiplos de ₡5, así que cualquier combinación de monedas reales da como resultado un múltiplo de 5 (con las únicas excepciones triviales de ₡5 y ₡15 exactos, que no importan para un precio real — ver el comentario en `products.service.js` si hace falta la demostración matemática). Un monto que no sea múltiplo de 5 (ej. ₡799, ₡2548) no se podría cobrar ni dar de vuelto en efectivo, así que la regla se aplica en toda la cadena:
- **Precio de producto** (`products.service.js` `validatePrice()`, `products.js` en el frontend): debe ser un entero múltiplo de ₡5. Se rechaza en creación y edición, tanto frontend (UX) como backend (real).
- **Descuento manual** (`sale.service.js`): el monto en colones se redondea a múltiplo de 5 (`round5()`) al calcularlo — como el total de productos ya es múltiplo de 5 (suma de precios que ya lo son), el total final después del descuento se mantiene múltiplo de 5 sin importar el método de pago.
- **Promo 2x1 Gelatina**: no necesita redondeo aparte — el descuento es directamente el precio de una unidad, que ya es múltiplo de 5.
- **Efectivo recibido** (`nuevaVenta.js`): también debe ser múltiplo de ₡5, por la misma razón — el vuelto calculado (recibido − total) queda múltiplo de 5 automáticamente.
- El desglose de Subtotal/IVA que se muestra (accounting, no dinero físico que se entrega por separado) sigue permitiendo decimales — eso es normal y no rompe la regla, porque lo único que se cobra/paga en monedas reales es el **total**.

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
- No hay `sequelize.sync()` — el esquema de BD se gestiona a mano con `database/init.sql` (instalación nueva) y `database/migrations/*.sql` (cambios sobre una BD existente). Si ya tenías el proyecto corriendo, ejecutá en orden `001_add_email_to_users.sql`, `002_add_totp_confirmation.sql`, `003_add_must_change_password.sql`, `004_add_image_to_products.sql`, `005_add_customer_details_to_sales.sql`, `006_add_discount_percentage_to_sales.sql` y `007_add_customer_email_to_sales.sql` contra tu BD local y Neon.
- **Cuando se agrega un campo nuevo a un modelo**: hay que agregarlo en `src/models/index.js` (el que usa `getModels()` de verdad), no solo en el archivo `*.model.js` suelto de `src/models/` — esos archivos sueltos (`user.model.js`, `product.model.js`, `sale.model.js`, `saleItem.model.js`) no los importa nada, quedaron de una versión anterior y es fácil editar el que no se usa por error (pasó con `discount_percentage`, ver sección de HU-05).
- Si agregás una dependencia nueva al backend (`package.json`), `docker compose build backend` no alcanza — el volumen anónimo `/app/node_modules` puede quedar con la versión vieja. Usá `docker compose up -d --force-recreate --renew-anon-volumes backend` después de buildear.
- **NUNCA** subir el `.env` a GitHub — el `.gitignore` ya lo protege
- Los modelos se inicializan con `initModels()` en `index.js` y se acceden con `getModels()` en los servicios
- El frontend usa **volumen en Docker** — los cambios en HTML/CSS/JS se ven al recargar el navegador sin rebuild
- El backend requiere rebuild (`docker compose build --no-cache backend`) cuando se agregan paquetes npm nuevos
- Swagger documenta todos los endpoints en `/api-docs` con comentarios JSDoc en las rutas
