const { getModels } = require('../src/models');

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB decodificados

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('La imagen debe enviarse como data URL base64 (data:image/...;base64,...).');
  const [, mimeType, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('La imagen no puede pesar más de 3MB.');
  return { mimeType, buffer };
}

class ProductsService {

  async list() {
    const { Product } = getModels();
    const products = await Product.findAll({ order: [['id', 'ASC']] });
    return products.map(p => ({
      id: p.id, name: p.name, price: p.price, active: p.active,
      hasImage: !!p.image
    }));
  }

  async getById(id) {
    const { Product } = getModels();
    const product = await Product.findByPk(id);
    if (!product) throw new Error('Producto no encontrado.');
    return {
      id: product.id, name: product.name, price: product.price,
      active: product.active, image: product.image || null
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
    if (Number.isNaN(numericPrice) || numericPrice < 0)
      throw new Error('El precio debe ser un número válido mayor o igual a 0.');

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

    return { id: product.id, name: product.name, price: product.price, active: product.active, hasImage: !!product.image };
  }

  async update(id, { name, price, image, active }) {
    const { Product } = getModels();
    const product = await Product.findByPk(id);
    if (!product) throw new Error('Producto no encontrado.');

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (price !== undefined) {
      const numericPrice = Number(price);
      if (Number.isNaN(numericPrice) || numericPrice < 0)
        throw new Error('El precio debe ser un número válido mayor o igual a 0.');
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

    return { id: product.id, name: product.name, price: product.price, active: product.active, hasImage: !!product.image };
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
