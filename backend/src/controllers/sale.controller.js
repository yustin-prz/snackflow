const saleService = require('../../services/sale.service');

console.log("SALE CONTROLLER CARGADO");

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
        const sale = await saleService.create(req.body);
        res.status(201).json(sale);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    list, getById, create
};