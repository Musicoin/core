const Web3Reader = require('../../components/blockchain/web3-reader');
const Web3Writer = require('../../components/blockchain/web3-writer');
const ArtistModule = require('../../js-api/artist');
const LicenseModule = require('../../js-api/license');
const TxModule = require('../../js-api/tx');
const Web3 = require('web3');

function ComponentRegistry(config) {
  this.web3 = new Web3();
  this.web3.setProvider(new this.web3.providers.HttpProvider(config.web3Url));
  this.web3Reader = new Web3Reader(this.web3, config);
  this.web3Writer = new Web3Writer(this.web3Reader, config.maxCoinsPerPlay);
  this.artistModule = new ArtistModule(this.web3Reader, this.web3Writer, config.maxCoinsPerPlay);
  this.licenseModule = new LicenseModule(this.web3Reader, this.web3Writer);
  this.txModule = new TxModule(this.web3Reader, this.licenseModule, this.artistModule);
  this.isRegistry = true;
}

ComponentRegistry.prototype.getArtistModule = function() { return this.artistModule};
ComponentRegistry.prototype.getLicenseModule = function() { return this.licenseModule};
ComponentRegistry.prototype.getTxModule = function() { return this.txModule};
ComponentRegistry.prototype.getWeb3Reader = function() { return this.web3Reader};
ComponentRegistry.prototype.getWeb3Writer = function() { return this.web3Writer};

module.exports = ComponentRegistry;
