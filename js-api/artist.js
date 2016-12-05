var Promise = require('bluebird');
var request = require('request');

function ArtistModule(web3Reader, mediaProvider) {
  this.web3Reader = web3Reader;
  this.mediaProvider = mediaProvider;
  this.musicoinMusicianURL = "http://catalog.musicoin.org/api/musician/content";
}

ArtistModule.prototype.getArtistByOwner = function(ownerAddress) {
  return this._getArtistDetails(this.web3Reader.getArtistByOwner(ownerAddress), ownerAddress)
};

ArtistModule.prototype.getArtistByProfile = function(profileAddress) {
  return this._getArtistDetails(this.web3Reader.getArtistByProfile(profileAddress))
};

ArtistModule.prototype._getArtistDetails = function(profile, originalAddress) {
  return profile
    .bind(this)
    .then(function(result) {
      var d = this.mediaProvider.readTextFromIpfs(result.descriptionUrl);
      var s = this.mediaProvider.readJsonFromIpfs(result.socialUrl);
      var r = this.loadReleases(originalAddress)
        .catch(function(err) {
          console.log("Failed to load releases for artist: " + originalAddress + ", error: " + err);
          return [];
        });
      return Promise.join(d, s, r, function(description, social, releases) {
        result.description = description;
        result.social = social;
        result.image = this.mediaProvider.resolveIpfsUrl(result.imageUrl);
        result.releases = releases.map(function(nr) {
          return {
            title: nr.song_name,
            tips: nr.tip_count,
            plays: nr.play_count,
            licenseAddress: nr.contract_id,
            image: nr.work.image_url
          }
        });
        return result;
      }.bind(this))
    })
};

// TODO: This should come from a database, since the musicoin.org API may be deprecated
ArtistModule.prototype.loadReleases = function(artist_address) {
  var propertiesObject = {address: artist_address};
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
        resolve(body.content.new_releases);
      }
      else {
        console.log("Unable to load artist: " + error);
        reject(error);
      }
    }.bind(this))
  }.bind(this));
};

module.exports = ArtistModule;
