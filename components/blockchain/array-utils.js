const Promise = require('bluebird');

/*
 * Some nasty code to deal with not knowing the length of the arrays in the contract.  Future versions
 * of the contracts should expose the length and then most of this will go away.
 */

const extractArray = function(provider, length) {
  const promises = [];
  for (let idx = 0; idx < length; idx++) {
    promises.push(provider(idx).call());
  }
  return Promise.all(promises);
};

const extractAddressArray = function(provider, startIdx, result) {
  return new Promise(function(resolve, reject) {
    const output = result || [];
    const idx = startIdx || 0;
    provider(idx).call()
        .then(function(value) {
          if (value) {
            output.push(value);
            resolve(extractAddressArray(provider, idx + 1, output));
          } else {
            resolve(output);
          }
        })
        .catch(function() {
           resolve(output);
        });
  });
};

const extractAddressAndValues = function(addressArray, valueArray, valueName) {
  const ctx = {};
  if (!addressArray) return Promise.resolve([]);

  return extractAddressArray(addressArray, 0)
      .then(function(addresses) {
        ctx.addresses = addresses;
        return extractArray(valueArray, addresses.length);
      })
      .then(function(values) {
        return ctx.addresses.map(function(address, idx) {
          const output = {};
          output['address'] = address;
          output[valueName] = values[idx];
          return output;
        });
      });
};

const equals = function(array1, array2) {
  if (array1 && !array2) return false;
  if (!array1 && array2) return false;
  if (array1.length != array2.length) return false;
  for (var i = 0, l = array1.length; i < l; i++) {
    if (array1[i] != array2[i]) return false;
  }
  return true;
};

module.exports.equals = equals;
module.exports.extractArray = extractArray;
module.exports.extractAddressArray = extractAddressArray;
module.exports.extractAddressAndValues = extractAddressAndValues;
