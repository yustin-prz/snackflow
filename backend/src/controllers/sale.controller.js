const saleService = require('../../services/sale.service');

const list = async (req, res) => {
  try {
    const sales = await saleService.list();
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const sale = await saleService.getById(req.params.id);
    res.json(sale);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const create = async (req, res) => {
  try {
    // user_id siempre del token autenticado, nunca del body.
    const sale = await saleService.create({ ...req.body, user_id: req.user.id });
    res.status(201).json(sale);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const complete = async (req, res) => {
  try {
    const sale = await saleService.complete(req.params.id, req.body.payment_method);
    res.json(sale);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { list, getById, create, complete };
