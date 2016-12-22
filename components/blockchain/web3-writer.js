const Promise = require("bluebird");
const Web3Reader = require('./web3-reader');

function Web3Writer(web3Reader) {
  this.web3 = web3Reader.getWeb3();
  this.web3Reader = web3Reader;
}

Web3Writer.prototype.setCredentialsProvider = function(provider) {
  this.credentialsProvider = provider;
};

Web3Writer.createInMemoryCredentialsProvider = function(account, password) {
  return {
    getCredentials: function() {
      return Promise.resolve({
        account: account,
        password: password
      });
    }
  }
};

Web3Writer.prototype.unlockAccount = function (provider) {
  provider = provider || this.credentialsProvider;
  if (!provider)
    throw new Error("You must provide a credentials provider or call setCredentialsProvider before sending transactions");

  return provider.getCredentials()
    .bind(this)
    .then(function(credentials) {
      return this.unlockAccountWithCredentials(credentials);
    })
};

Web3Writer.prototype.unlockAccountWithCredentials = function (credentials) {
  return new Promise(function (resolve, reject) {
    this.web3.personal.unlockAccount(credentials.account, credentials.password, 10, function(err, result) {
      if (result) {
        resolve(credentials.account);
      }
      else {
        reject(new Error("Unlocking account failed: " + err));
      }
    });
  }.bind(this));
};

Web3Writer.prototype.tipLicense = function (licenseAddress, weiTipAmount, credentialsProvider) {
  return this.unlockAccount(credentialsProvider)
    .bind(this)
    .then(function(account) {
      const contract = this.web3Reader.getLicenseContractInstance(licenseAddress);
      const params = {from: account, value: weiTipAmount, gas: 940000};
      return new Promise(function(resolve, reject) {
        //noinspection JSUnresolvedFunction
        contract.tip(params, function (err, tx) {
          if (err) reject(err);
          else resolve(tx);
        });
      })
    })
    .then(function(tx) {
      console.log("Sending tip, tx: " + tx);
      return tx;
    })
};

Web3Writer.prototype.ppp = function (licenseAddress, credentialsProvider) {
  return Promise.join(
    this.web3Reader.loadLicense(licenseAddress),
    this.unlockAccount(credentialsProvider),
    function(license, sender) {
      const contract = this.web3Reader.getLicenseContractInstance(licenseAddress);
      const params = {from: sender, value: license.weiPerPlay, gas: 940000};
      return new Promise(function(resolve, reject) {
        //noinspection JSCheckFunctionSignatures
        contract.play(params, function (err, tx) {
          if (err) reject(err);
          else resolve(tx);
        });
      })
    }.bind(this))
    .then(function(tx) {
      console.log("Sending ppp, tx: " + tx);
      return tx;
    });
};

/**
 *
 * @param releaseRequest: A JSON object with the following structure
 * {
 *    owner: The address of the contract owner, which will have administrative rights
 *    title: "My Song Title",
 *    profileAddress: <address of the Artist profile contract>,
 *    coinsPerPlay: The number of Musicoins to charge for each stream (e.g. 1)
 *    resourceUrl: A URL indicating the location of the audio resource (e.g. ipfs://<hash>)
 *    metadataUrl: A URL indicating the location of the metadata file (e.g. ipfs://<hash>)
 *    royalties: A JSON array of the fixed amount royalty payments to be paid for each play, where each item has an address and an
 *       amount defined Musicoin, e.g. [{address: 0x111111, amount: 0.5}, {address: 0x222222, amount: 0.1}]
 *    contributors: A JSON array of the proportional amount to be paid for each play and tip, where each item
 *       has an address and an integer number of shares, e.g. [{address: 0x111111, shares: 5}, {address: 0x222222, shares: 3}].
 * }
 * @param credentialsProvider: (optional) The credentials provider.  If this is not provided, the default provider will be used.
 *        Web3Writer#setCredentialsProvider
 * @returns {*|Promise.<tx>} a Promise that resolves to the transaction hash
 */
// example: 0xc03cfa7500b44f238f8324651df9a3c383bca36e
Web3Writer.prototype.releaseLicenseV5 = function (releaseRequest, credentialsProvider) {
  const contractDefinition = this.web3Reader.getContractDefinition(Web3Reader.ContractTypes.PPP, "v0.5");

  if (!releaseRequest.owner && credentialsProvider) {
    releaseRequest.owner = credentialsProvider.getCredentials().account;
  }

  // copy all params from releaseRequest and then add some computed params
  // the names should stay close to the contract constructor args
  const params = Object.assign({}, releaseRequest, {
    artistProfileAddress: releaseRequest.profileAddress,
    royalties: releaseRequest.royalties.map(r => r.address),
    royaltyAmounts: releaseRequest.royalties.map(r => r.amount).map(this.toIndivisibleUnits),
    contributors: releaseRequest.contributors.map(r => r.address),
    contributorShares: releaseRequest.contributors.map(r => r.shares),
    weiPerPlay: this.toIndivisibleUnits(releaseRequest.coinsPerPlay),
  });

  return this.releaseContract(contractDefinition, params, credentialsProvider);
};

Web3Writer.prototype.releaseArtistProfileV2 = function(releaseRequest, credentialsProvider) {
  const contractDefinition = this.web3Reader.getContractDefinition(Web3Reader.ContractTypes.ARTIST, "v0.2");
  if (releaseRequest.profileAddress) {
    return this.updateArtistProfile(releaseRequest, credentialsProvider);
  }
  else {
    if (!releaseRequest.owner && credentialsProvider) {
      releaseRequest.owner = credentialsProvider.getCredentials().account;
    }
    return this.releaseContract(contractDefinition, releaseRequest, credentialsProvider);
  }
};

Web3Writer.prototype.updateArtistProfile = function(releaseRequest, credentialsProvider) {
  const contractDefinition = this.web3Reader.getContractDefinition(Web3Reader.ContractTypes.ARTIST, "v0.2");
  const contract = this.web3Reader.getContractAt(contractDefinition.abi, releaseRequest.profileAddress);

  return this.unlockAccount(credentialsProvider)
    .bind(this)
    .then((account) => {
      const params = {from: account, gas:120000};
      return contract.updateDetailsAsync(
          releaseRequest.artistName,
          releaseRequest.imageUrl,
          releaseRequest.descriptionUrl,
          releaseRequest.socialUrl,
          params)
      }
    )
};

Web3Writer.prototype.releaseContract = function(contractDefinition, releaseRequest, credentialsProvider) {
  return this.unlockAccount(credentialsProvider)
    .then(function (account) {
      return new Promise(function (resolve, reject) {
        const constructorArgs = _extractRequiredProperties(releaseRequest, contractDefinition.constructorArgs);
        this.web3.eth.contract(contractDefinition.abi).new(
          ...constructorArgs,
          _createNewContractProperties(account, contractDefinition),
          _createNewContractListener(resolve, reject, account, contractDefinition));
      }.bind(this))
    }.bind(this))
};

Web3Writer.prototype.createAccount = function(pwd) {
  return new Promise(function(resolve, reject) {
    try {
      const newAccount = this.web3.personal.newAccount(pwd);
      return resolve(newAccount);
    } catch (e) {
      reject(e);
    }
  }.bind(this));
};

Web3Writer.prototype.toIndivisibleUnits = function (musicCoins) {
  return this.web3.toWei(musicCoins, 'ether');
};

const _extractRequiredProperties = function(sourceObject, names) {
  return names.map(f => {
    if (!sourceObject.hasOwnProperty(f)) {
      throw Error("Could not find required property: " + f);
    }
    return sourceObject[f];
  })
};

const _createNewContractListener = function(resolve, reject, account, contractDefinition) {
  return function (e, contract) {
    const label = contractDefinition.type + ", version " + contractDefinition.version;
    if (e) {
      console.log("Failed to deploy " + label + ": " + e);
      reject(e);
    }
    else {
      console.log("Deploying " + label + ", transactionHash: " + contract.transactionHash + ", contractAddress: " + contract.address);
      resolve(contract.transactionHash);
    }
  }
};

const _createNewContractProperties = function(account, contractDefinition) {
  return {
    from: account,
    data: contractDefinition.code,
    gas: contractDefinition.deploymentGas
  };
};

module.exports = Web3Writer;