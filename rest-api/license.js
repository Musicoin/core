const Promise = require('bluebird');
const express  = require('express');
const JsonPromiseRouter = require('./json-promise-router');
const router = express.Router();
const jsonRouter = new JsonPromiseRouter(router, "license");
var jsonParser = require('body-parser').json();
let licenseModule;
let publishCredentialsProvider;
let paymentAccountCredentialsProvider;
let contractOwnerAccount;
let accountManager;
const LicenseKey = require('../components/models/key');
const defaultRecords = 20;
const maxRecords = 100;
const defaultMaxGroupSize = 8;

function getLimit(req) {
    return Math.max(0, Math.min(req.query.limit || defaultRecords, maxRecords));
}
//jsonRouter.get('/recenttracks', (req) => licenseModule.getRecentPlays(getLimit(req)));
jsonRouter.get('/detail/:address', (req, res) => licenseModule.getLicense(req.params.address));
jsonRouter.get('/getaudiourl/:address', (req, res) => licenseModule.getAudioLicense(req.params.address));
jsonRouter.get('/newreleases', (req) => licenseModule.getNewReleases(getLimit(req)));
jsonRouter.get('/top', req => licenseModule.getTopPlayed(getLimit(req), req.query.genre));
jsonRouter.get('/random', (req) => licenseModule.getSampleOfVerifiedTracks(getLimit(req), req.query.genre));
jsonRouter.get('/random/new', (req) => licenseModule.doGetRandomReleases({ ...req.query, limit: getLimit(req) }));
jsonRouter.get('/details', (req) => licenseModule.getTrackDetailsByIds(req.query.addresses));
jsonRouter.get('/find', (req) => {
  return licenseModule.getNewReleasesByGenre(
    getLimit(req),
    defaultMaxGroupSize,
    req.query.search);
});

// Not in documentation
jsonRouter.get('/ppp/:address', (req, res) => {
  const context = {};

  const l = licenseModule.getLicense(req.params.address);
  const k = new Promise(function(resolve, reject) {
    LicenseKey.findOne({licenseAddress: req.params.address}, function(err, licenseKey) {
      if (!licenseKey) return reject({err: "License not found: " + req.params.address});
      return resolve({key: licenseKey.key});
    })
  });

  return Promise.join(l, k, function(license, keyResult) {
    context.output = keyResult;
    return accountManager.pay(req.user.clientID, license.musicPerPlay);
  })
    .then(function() {
      return licenseModule.ppp(req.params.address, paymentAccountCredentialsProvider);
    })
    .then(function(tx) {
      console.log(`Initiated payment, tx: ${tx}`);
      context.output.tx = tx;
      return context.output;
    })
    .catch(function(err) {
      console.log(err);
      return {err: "Failed to acquire key or payment was rejected"};
    })
});

router.post('/distributeBalance/', jsonParser, (req, res) => {
  return licenseModule.distributeBalance(req.body.address)
    .then(tx => {
      res.send({tx: tx});
    })
    .catch(function (err) {
      res.status(500)
      res.send(err);
    });
});

router.post('/update', jsonParser, function(req, res) {
  console.log("Received license UPDATE release request: " + JSON.stringify(req.body));
  licenseModule.updatePPPLicense({
    contractAddress: req.body.contractAddress,
    title: req.body.title,
    imageUrl: req.body.imageUrl,
    metadataUrl: req.body.metadataUrl,
    contributors: req.body.contributors,
    coinsPerPlay: 1
  }, publishCredentialsProvider)
    .then(txs => {
      res.json({txs: txs});
    })
    .catch(err => {
      console.log(err);
      res.status(500);
      res.send(err);
    });
});

router.post('/', jsonParser, function(req, res) {
  console.log("Received license release request: " + JSON.stringify(req.body));
  publishCredentialsProvider.getCredentials()
    .then(function(credentials) {
      return licenseModule.releaseLicense({
        owner: contractOwnerAccount,
        profileAddress: req.body.profileAddress,
        artistName: req.body.artistName,
        title: req.body.title,
        resourceUrl: req.body.audioUrl,
        contentType: req.body.contentType,
        imageUrl: req.body.imageUrl,
        metadataUrl: req.body.metadataUrl,
        coinsPerPlay: 1,
        royalties: req.body.royalties || [],
        contributors: req.body.contributors || [{address: req.body.profileAddress, shares: 1}]
      }, publishCredentialsProvider)
    })
    .then(function(tx) {
      console.log("Got transaction hash for release request: " + tx);
      res.json({tx: tx});
      const newKey = new LicenseKey();
      newKey.tx = tx;
      newKey.key = req.body.encryptionKey;
      newKey.save(err => {
        if (err) console.log(`Failed to save key: ${err}`)
      });

      console.log("Waiting for tx: " + tx);
      licenseModule.getWeb3Reader().waitForTransaction(tx)
        .then(function(receipt) {
          console.log("Got receipt: " + JSON.stringify(receipt));
          newKey.licenseAddress = receipt.contractAddress;
          newKey.save(function(err) {
            if (err) {
              console.log("Failed to save license key!");
              throw err;
            }
            else {
              console.log("Saved key!");
            }
          });
        })
    })
    .catch(err => {
      console.log(err);
      res.status(500);
      res.send(err);
    });
});

module.exports.init = function(_licenseModule, _accountManager, _publishCredentialsProvider, _paymentAccountCredentialsProvider, _contractOwnerAccount) {
  accountManager = _accountManager;
  licenseModule = _licenseModule;
  publishCredentialsProvider = _publishCredentialsProvider;
  paymentAccountCredentialsProvider = _paymentAccountCredentialsProvider;
  contractOwnerAccount = _contractOwnerAccount;
  return router;
};
