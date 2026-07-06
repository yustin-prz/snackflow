const usersService = require('../../services/users.service');

const list = async (req, res) => {
  try {
    const users = await usersService.list();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const user = await usersService.getById(req.params.id);
    res.json(user);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const create = async (req, res) => {
  try {
    const user = await usersService.create(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const update = async (req, res) => {
  try {
    const user = await usersService.update(req.params.id, req.body);
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const setStatus = async (req, res) => {
  try {
    const { active, totpToken } = req.body;
    const result = await usersService.setActive(req.params.id, !!active, req.user.id, totpToken);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getQr = async (req, res) => {
  try {
    const result = await usersService.getQr(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { list, getById, create, update, setStatus, getQr };
