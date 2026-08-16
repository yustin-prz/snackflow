const crypto = require('crypto');
const { getModels } = require('../src/models');

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB decodificados

// En Costa Rica no existen monedas/billetes fraccionarios: las denominaciones
// (₡10, ₡25, ₡50, ₡100, ₡500, ...) son todas múltiplos de ₡5, así que
// cualquier combinación de monedas reales siempre da un múltiplo de 5 (con
// las únicas excepciones triviales de ₡5 y ₡15, que no importan para un
// precio real). Un precio que no sea múltiplo de 5 (ej. ₡799, ₡2548) no se
// podría cobrar/dar de vuelto en efectivo, así que no se deja guardar.
const COIN_BASE = 5;

function validatePrice(numericPrice) {
  if (Number.isNaN(numericPrice) || numericPrice < 0)
    throw new Error('El precio debe ser un número válido mayor o igual a 0.');
  if (!Number.isInteger(numericPrice) || numericPrice % COIN_BASE !== 0)
    throw new Error(`El precio debe ser un múltiplo de ₡${COIN_BASE} (no existen monedas más pequeñas en Costa Rica).`);
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('La imagen debe enviarse como data URL base64 (data:image/...;base64,...).');
  const [, mimeType, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('La imagen no puede pesar más de 3MB.');
  return { mimeType, buffer };
}

// El endpoint de imagen se cachea en el navegador (Cache-Control), pero su URL
// no cambia cuando se reemplaza la foto de un producto. Este hash del contenido
// se manda como query param (?v=...) para forzar al navegador a pedir la nueva
// versión en vez de seguir mostrando la que tenía cacheada.
function imageVersion(image) {
  if (!image) return null;
  return crypto.createHash('md5').update(image).digest('hex').slice(0, 10);
}

class ProductsService {

  async list() {
    const { Product } = getModels();
    const products = await Product.findAll({ order: [['id', 'ASC']] });
    return products.map(p => ({
      id: p.id, name: p.name, price: p.price, active: p.active,
      hasImage: !!p.image, imageVersion: imageVersion(p.image)
    }));
  }

  async getById(id) {
    const { Product } = getModels();
    const product = await Product.findByPk(id);
    if (!product) throw new Error('Producto no encontrado.');
    return {
      id: product.id, name: product.name, price: product.price,
      active: product.active, image: product.image || null,
      imageVersion: imageVersion(product.image)
    };
  }

  async getImage(id) {
    const { Product } = getModels();
    const product = await Product.findByPk(id);
    if (!product) throw new Error('Producto no encontrado.');
    if (!product.image) throw new Error('Este producto no tiene imagen.');
    return parseDataUrl(product.image);
  }

  async create({ name, price, image, active }) {
    if (!name || price === undefined || price === null)
      throw new Error('El nombre y el precio son requeridos.');
    const numericPrice = Number(price);
    validatePrice(numericPrice);

    let storedImage = null;
    if (image) {
      parseDataUrl(image); // valida formato y tamaño
      storedImage = image;
    }

    const { Product } = getModels();
    const product = await Product.create({
      name, price: numericPrice, image: storedImage,
      active: active === undefined ? true : !!active
    });

    return { id: product.id, name: product.name, price: product.price, active: product.active, hasImage: !!product.image, imageVersion: imageVersion(product.image) };
  }

  async update(id, { name, price, image, active }) {
    const { Product } = getModels();
    const product = await Product.findByPk(id);
    if (!product) throw new Error('Producto no encontrado.');

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (price !== undefined) {
      const numericPrice = Number(price);
      validatePrice(numericPrice);
      updates.price = numericPrice;
    }
    if (active !== undefined) updates.active = !!active;
    if (image !== undefined) {
      if (image === null || image === '') {
        updates.image = null;
      } else {
        parseDataUrl(image);
        updates.image = image;
      }
    }

    await product.update(updates);

    return { id: product.id, name: product.name, price: product.price, active: product.active, hasImage: !!product.image, imageVersion: imageVersion(product.image) };
  }

  async remove(id) {
    const { Product } = getModels();
    const product = await Product.findByPk(id);
    if (!product) throw new Error('Producto no encontrado.');

    try {
      await product.destroy();
    } catch (error) {
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        throw new Error('No se puede eliminar el producto: tiene ventas asociadas.');
      }
      throw error;
    }

    return { message: 'Producto eliminado correctamente.' };
  }

}

module.exports = new ProductsService();
