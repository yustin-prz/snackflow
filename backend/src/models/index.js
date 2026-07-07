const { getSequelize } = require('../config/database');
const { DataTypes }    = require('sequelize');

let User, Product, Sale, SaleItem;

const initModels = () => {
  const sequelize = getSequelize();

  User = sequelize.define('User', {
    id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username:    { type: DataTypes.STRING(50), allowNull: false, unique: true },
    email:       { type: DataTypes.STRING(150), allowNull: false, unique: true, validate: { isEmail: true } },
    password:    { type: DataTypes.STRING(255), allowNull: false },
    full_name:   { type: DataTypes.STRING(100), allowNull: false },
    role:        { type: DataTypes.ENUM('admin', 'cashier'), allowNull: false },
    active:      { type: DataTypes.BOOLEAN, defaultValue: true },
    totp_secret: { type: DataTypes.STRING(255), allowNull: true },
    totp_confirmed:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    totp_setup_deadline: { type: DataTypes.DATE, allowNull: true },
    must_change_password: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, { tableName: 'users', timestamps: true, createdAt: 'created_at', updatedAt: false });

  Product = sequelize.define('Product', {
    id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name:   { type: DataTypes.STRING(100), allowNull: false },
    price:  { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
    image:  { type: DataTypes.TEXT, allowNull: true }
  }, { tableName: 'products', timestamps: false });

  Sale = sequelize.define('Sale', {
    id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id:        { type: DataTypes.INTEGER, allowNull: false },
    customer_name:  { type: DataTypes.STRING(100), allowNull: true },
    subtotal:       { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    discount:       { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    tax:            { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    total:          { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    payment_method: { type: DataTypes.ENUM('cash', 'card'), allowNull: true },
    status:         { type: DataTypes.ENUM('open', 'completed', 'cancelled'), defaultValue: 'open' },
    promotion:      { type: DataTypes.STRING(50), allowNull: true }
  }, { tableName: 'sales', timestamps: true, createdAt: 'created_at', updatedAt: false });

  SaleItem = sequelize.define('SaleItem', {
    id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    sale_id:    { type: DataTypes.INTEGER, allowNull: false },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    quantity:   { type: DataTypes.INTEGER, allowNull: false },
    unit_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    subtotal:   { type: DataTypes.DECIMAL(10, 2), allowNull: false }
  }, { tableName: 'sale_items', timestamps: false });

  // Relaciones
  User.hasMany(Sale,       { foreignKey: 'user_id' });
  Sale.belongsTo(User,     { foreignKey: 'user_id' });
  Sale.hasMany(SaleItem,   { foreignKey: 'sale_id' });
  SaleItem.belongsTo(Sale, { foreignKey: 'sale_id' });
  Product.hasMany(SaleItem,    { foreignKey: 'product_id' });
  SaleItem.belongsTo(Product,  { foreignKey: 'product_id' });
};

module.exports = { initModels, getModels: () => ({ User, Product, Sale, SaleItem }) };
