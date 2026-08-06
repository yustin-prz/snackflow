const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Sale = sequelize.define('Sale', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  customer_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  customer_phone: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  discount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  // Porcentaje del descuento MANUAL (HU-05), ej. 8.5 = 8.5%. Null cuando no
  // hay descuento manual activo (incluye el caso de la promo 2x1, que no usa
  // porcentaje: su monto se recalcula directo desde el precio del producto).
  // Se guarda por separado de "discount" (que es el monto en colones) porque
  // si se agregan/quitan productos después de aplicar el descuento, hay que
  // poder volver a calcular el monto sin perder el porcentaje original.
  discount_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: null
  },
  tax: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  payment_method: {
    type: DataTypes.ENUM('cash', 'card'),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('open', 'completed', 'cancelled'),
    defaultValue: 'open'
  },
  promotion: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  tableName: 'sales',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = Sale;