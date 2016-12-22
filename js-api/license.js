function LicenseModule(web3Reader, web3Writer) {
  this.web3Reader = web3Reader;
  this.web3Writer = web3Writer;
};

/**
 * @param {string} address
 * @returns {*|Promise.<TResult>}
 */
LicenseModule.prototype.getLicense = function(address) {
  return this.web3Reader.loadLicense(address)
};

LicenseModule.prototype.releaseLicense = function(releaseRequest, credentialsProvider) {
  return this.web3Writer.releaseLicenseV5(releaseRequest, credentialsProvider);
};

LicenseModule.prototype.getWeb3Reader = function() {
  return this.web3Reader;
};

module.exports = LicenseModule;
