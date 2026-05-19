const speakeasy = require('speakeasy');
const QRCode    = require('qrcode');

class TotpService {

  generateSecret(username) {
    const secret = speakeasy.generateSecret({
      name:   `SnackFlow POS (${username})`,
      issuer: 'SnackFlow'
    });
    return {
      base32: secret.base32,
      otpauth_url: secret.otpauth_url
    };
  }

  async generateQR(otpauth_url) {
    return await QRCode.toDataURL(otpauth_url);
  }

  verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1
    });
  }

}

module.exports = new TotpService();