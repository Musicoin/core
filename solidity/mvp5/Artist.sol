pragma solidity ^0.4.2;
contract Artist {
    string public contractVersion = "v0.2";
    address public owner;
    string public artistName;
    string public imageUrl;
    string public descriptionUrl;
    string public socialUrl;


    uint public tipCount = 0;
    uint public tipTotal = 0;
    mapping(address => bool) public following;
    uint public followers = 0;

    modifier onlyOwner {
        if (msg.sender != owner) throw;
        _;
    }

    function Artist(
        string _artistName,
        string _imageUrl,
        string _descriptionUrl,
        string _socialUrl) {
        owner = msg.sender;
        artistName = _artistName;
        imageUrl = _imageUrl;
        descriptionUrl = _descriptionUrl;
        socialUrl = _socialUrl;
    }

    function tip() payable {
        tipCount++;
        tipTotal += msg.value;
        if (!owner.send(msg.value)) {
            throw;
        }
    }

    function follow() {
        if (!following[msg.sender]) {
            following[msg.sender] = true;
            followers++;
        }
    }

    function unfollow() {
        if (following[msg.sender]) {
            following[msg.sender] = false;
            followers--;
        }
    }

    function updateDetails(
        string _artistName,
        string _imageUrl,
        string _descriptionUrl,
        string _socialUrl) onlyOwner {
        artistName = _artistName;
        imageUrl = _imageUrl;
        descriptionUrl = _descriptionUrl;
        socialUrl = _socialUrl;
    }

    function setOwner(address _owner) onlyOwner {
        owner = _owner;
    }

    function setArtistName(string _artistName) onlyOwner {
        artistName = _artistName;
    }

    function setImageUrl(string _imageUrl) onlyOwner {
        imageUrl = _imageUrl;
    }

    function setDescriptionUrl(string _descriptionUrl) onlyOwner {
        descriptionUrl = _descriptionUrl;
    }

    function setSocialUrl(string _socialUrl) onlyOwner {
        socialUrl = _socialUrl;
    }
}