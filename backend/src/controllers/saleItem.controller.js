const saleItemService = require('../../services/saleItem.service');

const listItems = async (req, res) => {
    try {
        const items = await saleItemService.listItems(req.params.saleId);
        res.json(items);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

const addItem = async (req, res) => {
    try {
        const item = await saleItemService.addItem(
            req.params.saleId,
            req.body.product_id,
            req.body.quantity
        );

        res.status(201).json(item);

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateItem = async (req, res) => {
    try {

        const item = await saleItemService.updateItem(
            req.params.itemId,
            req.body.quantity
        );

        res.json(item);

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const removeItem = async (req, res) => {

    try {

        const result = await saleItemService.removeItem(req.params.itemId);

        res.json(result);

    } catch (error) {

        res.status(400).json({ message: error.message });

    }

};

module.exports = {
    listItems, addItem, updateItem, removeItem
};