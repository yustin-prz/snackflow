// XML "de demostración" con la forma de un Tiquete Electrónico (v4.4) de
// Hacienda Costa Rica — para mostrar en la defensa del proyecto que se
// entiende el formato real, NO para enviarlo como comprobante fiscal válido.
//
// Un Tiquete Electrónico (no Factura Electrónica) es el tipo correcto para
// este caso: venta al consumidor final donde no se pide la cédula del
// receptor — exactamente lo que hace La Matamonchis.
//
// Lo que este archivo DELIBERADAMENTE no hace, y por qué:
//   - No incluye <ds:Signature>. El schema real lo exige (minOccurs="1"),
//     pero ese nodo es una firma XAdES-BES hecha con un certificado emitido
//     por la CA de Hacienda (Ministerio de Hacienda / DGT) — fabricar ese
//     bloque sería falsificar una firma digital atribuida a una autoridad
//     certificadora del Estado. No se hace bajo ninguna circunstancia.
//   - La <Clave>, la cédula del emisor, el código de actividad económica y
//     el código CABYS son todos placeholders (ceros/nueves obvios), no
//     números reales calculados con el algoritmo oficial de Hacienda.
// Por estas dos cosas, este documento NUNCA sería aceptado por Hacienda ni
// debe presentarse como un comprobante real — es solo una demo del formato.

const CABYS_PLACEHOLDER = '9999999999999'; // 13 dígitos — normalmente sale del catálogo público de CABYS por producto
const CEDULA_PLACEHOLDER = '000000000000'; // 12 dígitos — normalmente la cédula jurídica real de la empresa
const ACTIVIDAD_PLACEHOLDER = '000000';     // 6 dígitos — código de actividad económica real inscrita ante Hacienda
const PROVEEDOR_SISTEMAS_PLACEHOLDER = '000000000';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function money5(n) {
  return Number(n).toFixed(5);
}

// Costa Rica no tiene horario de verano, así que el offset -06:00 es
// siempre correcto — a diferencia de toLocaleString(), esto sí arma el
// formato ISO 8601 con offset que pide xs:dateTime.
function fechaEmisionCR(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-06:00`;
}

// Clave de 50 dígitos: sigue el LARGO y la forma posicional real
// (país 3 + fecha 6 + cédula 12 + consecutivo 20 + situación 1 + código
// seguridad 8 = 50), pero con la cédula y el código de seguridad en cero —
// nunca sería una clave real generada por Hacienda.
function claveDemo(saleId, date) {
  const pais = '506';
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(date.getUTCFullYear()).slice(-2);
  const consecutivo = String(saleId).padStart(20, '0');
  const situacion = '1';
  const codigoSeguridad = '00000000';
  return `${pais}${dd}${mm}${yy}${CEDULA_PLACEHOLDER}${consecutivo}${situacion}${codigoSeguridad}`;
}

function buildInvoiceXml({ saleId, customerName, customerEmail, createdAt, paymentMethod, items, subtotal, discount, tax, total }) {
  const date = new Date(createdAt);
  const fecha = fechaEmisionCR(date);
  const clave = claveDemo(saleId, date);
  const consecutivo = String(saleId).padStart(20, '0');
  const tipoMedioPago = paymentMethod === 'cash' ? '01' : '02';

  // Nota de simplificación: el descuento manual/2x1 de esta app se aplica
  // sobre el total de la venta, no por línea — a diferencia del modelo real
  // de Hacienda, que espera un <Descuento> propio en cada LineaDetalle. Para
  // esta demo, cada línea usa directamente item.subtotal (ya con su parte
  // del descuento absorbida) como Monto/SubTotal/BaseImponible, en vez de
  // reconstruir un desglose de descuento por línea.
  const lineas = items.map((item, i) => {
    const n = i + 1;
    const montoLinea = Number(item.subtotal);
    const impuestoLinea = money5(montoLinea - (montoLinea / 1.13));
    return `    <LineaDetalle>
      <NumeroLinea>${n}</NumeroLinea>
      <CodigoCABYS>${CABYS_PLACEHOLDER}</CodigoCABYS>
      <Cantidad>${Number(item.quantity).toFixed(3)}</Cantidad>
      <UnidadMedida>Unid</UnidadMedida>
      <Detalle>${esc(item.product_name)}</Detalle>
      <PrecioUnitario>${money5(item.unit_price)}</PrecioUnitario>
      <MontoTotal>${money5(montoLinea)}</MontoTotal>
      <SubTotal>${money5(montoLinea)}</SubTotal>
      <BaseImponible>${money5(montoLinea)}</BaseImponible>
      <Impuesto>
        <Codigo>01</Codigo>
        <CodigoTarifaIVA>08</CodigoTarifaIVA>
        <Tarifa>13.00</Tarifa>
        <Monto>${impuestoLinea}</Monto>
      </Impuesto>
      <ImpuestoNeto>${impuestoLinea}</ImpuestoNeto>
      <MontoTotalLinea>${money5(item.subtotal)}</MontoTotalLinea>
    </LineaDetalle>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<!--
  DOCUMENTO DE DEMOSTRACIÓN — NO ES UN COMPROBANTE ELECTRÓNICO VÁLIDO.
-->
<TiqueteElectronico xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico">
  <Clave>${clave}</Clave>
  <ProveedorSistemas>${PROVEEDOR_SISTEMAS_PLACEHOLDER}</ProveedorSistemas>
  <CodigoActividadEmisor>${ACTIVIDAD_PLACEHOLDER}</CodigoActividadEmisor>
  <NumeroConsecutivo>${consecutivo}</NumeroConsecutivo>
  <FechaEmision>${fecha}</FechaEmision>
  <Emisor>
    <Nombre>La Matamonchis S.A.</Nombre>
    <Identificacion>
      <Tipo>02</Tipo>
      <Numero>${CEDULA_PLACEHOLDER}</Numero>
    </Identificacion>
    <NombreComercial>La Matamonchis</NombreComercial>
    <Ubicacion>
      <Provincia>1</Provincia>
      <Canton>01</Canton>
      <Distrito>01</Distrito>
      <OtrasSenas>Dirección de ejemplo — proyecto académico UTN</OtrasSenas>
    </Ubicacion>
    <CorreoElectronico>ventas@lamatamonchis.demo</CorreoElectronico>
  </Emisor>
  <Receptor>
    <Nombre>${esc(customerName || 'Cliente general')}</Nombre>
    <CorreoElectronico>${esc(customerEmail)}</CorreoElectronico>
  </Receptor>
  <CondicionVenta>01</CondicionVenta>
  <DetalleServicio>
${lineas}
  </DetalleServicio>
  <ResumenFactura>
    <CodigoTipoMoneda>
      <CodigoMoneda>CRC</CodigoMoneda>
      <TipoCambio>1.00000</TipoCambio>
    </CodigoTipoMoneda>
    <TotalMercanciasGravadas>${money5(subtotal)}</TotalMercanciasGravadas>
    <TotalGravado>${money5(subtotal)}</TotalGravado>
    <TotalVenta>${money5(Number(subtotal) + Number(discount))}</TotalVenta>
    <TotalDescuentos>${money5(discount)}</TotalDescuentos>
    <TotalVentaNeta>${money5(subtotal)}</TotalVentaNeta>
    <TotalDesgloseImpuesto>
      <Codigo>01</Codigo>
      <CodigoTarifaIVA>08</CodigoTarifaIVA>
      <TotalMontoImpuesto>${money5(tax)}</TotalMontoImpuesto>
    </TotalDesgloseImpuesto>
    <TotalImpuesto>${money5(tax)}</TotalImpuesto>
    <MedioPago>
      <TipoMedioPago>${tipoMedioPago}</TipoMedioPago>
      <TotalMedioPago>${money5(total)}</TotalMedioPago>
    </MedioPago>
    <TotalComprobante>${money5(total)}</TotalComprobante>
  </ResumenFactura>
</TiqueteElectronico>
`;
}

module.exports = { buildInvoiceXml };
