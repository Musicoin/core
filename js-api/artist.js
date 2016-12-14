const Promise = require('bluebird');
const request = require('request');

function ArtistModule(web3Reader, web3Writer, mediaProvider, musicoinMusicianURL) {
  this.web3Reader = web3Reader;
  this.web3Writer = web3Writer;
  this.mediaProvider = mediaProvider;
  this.musicoinMusicianURL = musicoinMusicianURL;
};

ArtistModule.prototype.getArtistByOwner = function(ownerAddress) {
  return this._getArtistDetails(this.web3Reader.getArtistByOwner(ownerAddress))
};

ArtistModule.prototype.getArtistByProfile = function(profileAddress) {
  return this._getArtistDetails(this.web3Reader.getArtistByProfile(profileAddress))
};

ArtistModule.prototype._getArtistDetails = function(profile) {
  const errors = [];
  return profile
    .bind(this)
    .then(function(result) {
      const d = _capture(errors, "", this.mediaProvider.readTextFromIpfs(result.descriptionUrl));
      const s = _capture(errors, {}, this.mediaProvider.readJsonFromIpfs(result.socialUrl));
      return Promise.join(d, s, function(description, social) {
        result.description = description;
        result.social = social;
        result.image = this.mediaProvider.resolveIpfsUrl(result.imageUrl);
        if (errors.length > 0) {
          result.errors = errors;
        }
        return result;
      }.bind(this))
    })
};

/**
 * @param releaseRequest A JSON object with the following properties:
 * {
 *    owner: The address of the profile owner, which has administrative rights over the account
 *    artistName: "Some Artist",
 *    description: "Some description about the artist",
 *    social: A JSON object properties like {linkedIn: "http://linkedin.com/theArsist", ...},
 *    imageResource: A file or stream referencing the artists profile
 * }
 * @param credentialsProvider: The credentials provider that will unlock the web3 account
 * @returns {Promise<string>} A Promise that will resolve to the address of the newly created profile contract
 */
ArtistModule.prototype.releaseProfile = function(releaseRequest, credentialsProvider) {
  const d = this.mediaProvider.uploadText(releaseRequest.description);
  const s = this.mediaProvider.uploadText(JSON.stringify(releaseRequest.social));
  const i = this.mediaProvider.upload(releaseRequest.imageResource);
  return Promise.join(d, s, i, function(descriptionUrl, socialUrl, imageUrl) {
    releaseRequest.descriptionUrl = descriptionUrl;
    releaseRequest.socialUrl = socialUrl;
    releaseRequest.imageUrl = imageUrl;
    return this.web3Writer.releaseArtistProfileV2(releaseRequest, credentialsProvider);
  }.bind(this));
};

const _capture = function(errors, defaultValue, p) {
  return p.catch(function(err) {
    errors.push(err);
    return defaultValue;
  });
};

// TODO: This should come from a database, since the musicoin.org API may be deprecated
ArtistModule.prototype.loadReleases = function(artist_address) {
  const propertiesObject = {address: artist_address};
  return new Promise(function (resolve, reject){
    return request({
      url: this.musicoinMusicianURL,
      qs: propertiesObject,
      json: true
    }, function (error, response, body) {
      if (!error && !body.success) {
        error = new Error(body.message);
      }

      if (!error && response.statusCode === 200) {
        resolve(body.content.new_releases.map(function(nr) {
          return {
            title: nr.song_name,
            tips: nr.tip_count,
            plays: nr.play_count,
            licenseAddress: nr.contract_id,
            image: nr.work.image_url
          }
        }));
      }
      else {
        console.log("Unable to load artist: " + error);
        reject(error);
      }
    }.bind(this))
  }.bind(this));
};

module.exports = ArtistModule;
