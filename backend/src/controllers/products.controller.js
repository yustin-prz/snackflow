const productsService = require('../../services/products.service');

const list = async (req, res) => {
  try {
    const products = await productsService.list();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const product = await productsService.getById(req.params.id);
    res.json(product);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const getImage = async (req, res) => {
  try {
    const { mimeType, buffer } = await productsService.getImage(req.params.id);
    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const create = async (req, res) => {
  try {
    const product = await productsService.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const update = async (req, res) => {
  try {
    const product = await productsService.update(req.params.id, req.body);
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const remove = async (req, res) => {
  try {
    const result = await productsService.remove(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { list, getById, getImage, create, update, remove };
