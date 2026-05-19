const User     = require('./user.model');
const Product  = require('./product.model');
const Sale     = require('./sale.model');
const SaleItem = require('./saleItem.model');

// Relaciones
User.hasMany(Sale,      { foreignKey: 'user_id' });
Sale.belongsTo(User,    { foreignKey: 'user_id' });

Sale.hasMany(SaleItem,      { foreignKey: 'sale_id' });
SaleItem.belongsTo(Sale,    { foreignKey: 'sale_id' });

Product.hasMany(SaleItem,   { foreignKey: 'product_id' });
SaleItem.belongsTo(Product, { foreignKey: 'product_id' });

module.exports = { User, Product, Sale, SaleItem };
