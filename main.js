"use strict";

(function () {
  var buildRoom = function buildRoom(room) {
    var addSizeToGoogleProfilePic = function addSizeToGoogleProfilePic(url) {
      return url.indexOf('googleusercontent.com') !== -1 && url.indexOf('?') === -1 ? url + '?sz=150' : url;
    };

    var getProfilePicUrl = function getProfilePicUrl() {
      return firebase.auth().currentUser.photoURL || 'profile_placeholder.png';
    };

    var getUserName = function getUserName() {
      return firebase.auth().currentUser.displayName;
    };

    var saveMessage = function saveMessage(messageText) {
      return firebase.firestore().collection(room).add({
        name: getUserName(),
        text: messageText,
        profilePicUrl: getProfilePicUrl(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      })["catch"](function (error) {
        return console.error('Error writing new message to Firebase Database', error);
      });
    };

    var saveImageMessage = function saveImageMessage(file) {
      return firebase.firestore().collection(room).add({
        name: getUserName(),
        imageUrl: 'https://www.google.com/images/spin-32.gif?a',
        profilePicUrl: getProfilePicUrl(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function (messageRef) {
        return firebase.storage().ref(firebase.auth().currentUser.uid + '/' + messageRef.id + '/' + file.name).put(file).then(function (fileSnapshot) {
          return fileSnapshot.ref.getDownloadURL().then(function (url) {
            return messageRef.update({
              imageUrl: url,
              storageUri: fileSnapshot.metadata.fullPath
            });
          });
        });
      })["catch"](function (error) {
        return console.error('There was an error uploading a file to Cloud Storage:', error);
      });
    };

    var deleteMessage = function deleteMessage(id) {
      var div = document.getElementById(id);

      if (div) {
        div.parentNode.removeChild(div);
      }
    };

    var displayMessage = function displayMessage(id, timestamp, name, text, picUrl, imageUrl) {
      var messageListElement = document.querySelector('.chat');
      var div = document.getElementById(id); // If an element for that message does not exists yet we create it.

      if (!div) {
        var container = document.createElement('div');
        container.innerHTML = '<div class="message-container"><div class="pic"></div><div><div class="name"></div><div class="message"></div></div></div>';
        div = container.firstChild;
        div.setAttribute('id', id);
        div.setAttribute('timestamp', timestamp);
        messageListElement.appendChild(div);
      }

      if (picUrl) {
        div.querySelector('.pic').style.backgroundImage = 'url(' + addSizeToGoogleProfilePic(picUrl) + ')';
      }

      div.querySelector('.name').textContent = name;
      var messageElement = div.querySelector('.message');

      if (text) {
        // If the message is text.
        messageElement.textContent = text; // Replace all line breaks by <br>.

        messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
      } else if (imageUrl) {
        // If the message is an image.
        var image = document.createElement('img');
        image.addEventListener('load', function () {
          return messageListElement.scrollTop = messageListElement.scrollHeight;
        });
        image.src = imageUrl + '&' + new Date().getTime();
        messageElement.innerHTML = '';
        messageElement.appendChild(image);
      } // Show the card fading-in and scroll to view the new message.


      setTimeout(function () {
        return div.classList.add('visible');
      }, 1);
      messageListElement.scrollTop = messageListElement.scrollHeight;
      document.querySelector('input').focus();
    };

    var $btnSignIn = $('#btn-sign-in').click(function () {
      return firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
    });
    var $btnSignOut = $('#btn-sign-out').click(function () {
      return firebase.auth().signOut();
    });
    $btnSignOut.hide();
    $btnSignIn.show();
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) {
        $btnSignOut.show();
        $btnSignIn.hide();
        $('#form-send-message input').removeAttr('disabled').attr('placeholder', 'Message');
        $('#form-send-message button').removeAttr('disabled');
        document.querySelector('#name').innerHTML = getUserName();
        document.querySelector('#pfp').src = addSizeToGoogleProfilePic(getProfilePicUrl());
      } else {
        $btnSignOut.hide();
        $btnSignIn.show();
        $('#form-send-message input').attr('disabled', 'disabled').attr('placeholder', 'Please sign in to send messages');
        $('#form-send-message button').attr('disabled', 'disabled');
        document.querySelector('#name').innerHTML = 'Please sign in <i class="fas fa-arrow-right"></i>';
        document.querySelector('#pfp').src = 'profile_placeholder.png';
      }
    });
    $('#btn-add-image').click(function (e) {
      e.preventDefault();
      e.stopPropagation();
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png, image/jpeg, image/gif';

      input.onchange = function (e) {
        var file = e.target.files[0];

        if (!file.type.match('image.*')) {
          alert('You can only share images');
          return;
        }

        saveImageMessage(file);
      };

      input.click();
    });
    $('#form-send-message').submit(function (e) {
      e.preventDefault();
      e.stopPropagation();
      var message = e.currentTarget.querySelector('input').value;
      e.currentTarget.querySelector('input').value = '';
      saveMessage(message);
    });

    var toggle = function toggle() {
      return $('.fa-expand-arrows-alt,.fa-compress-arrows-alt').toggleClass('fa-expand-arrows-alt fa-compress-arrows-alt');
    };

    document.addEventListener('fullscreenchange', toggle, false);
    document.addEventListener('webkitfullscreenchange', toggle, false);
    document.addEventListener('mozfullscreenchange', toggle, false);
    document.addEventListener('msfullscreenchange', toggle, false);

    var active = function active() {
      if (document.fullscreenElement != null) {
        return true;
      } else if (document.fullscreen) {
        return document.fullscreen;
      } else if (document.webkitIsFullScreen) {
        return document.webkitIsFullScreen;
      } else if (document.mozIsFullScreen) {
        return document.mozIsFullScreen;
      } else if (document.msIsFullScreen) {
        return document.msIsFullScreen;
      } else {
        return false;
      }
    };

    var $btnFullscreen = $('#btn-fullscreen').click(function () {
      if (active()) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozExitFullscreen) {
          document.mozExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      } else {
        if (document.body.requestFullscreen) {
          document.body.requestFullscreen();
        } else if (document.body.webkitRequestFullscreen) {
          document.body.webkitRequestFullscreen();
        } else if (document.body.mozRequestFullscreen) {
          document.body.mozRequestFullscreen();
        } else if (document.body.msRequestFullscreen) {
          document.body.msRequestFullscreen();
        } else {
          $btnFullscreen.hide();
          alert('Please use your browser\'s fullscreen.');
        }
      }
    });
    var query = firebase.firestore().collection(room).orderBy('timestamp', 'asc').limit(25);
    query.onSnapshot(function (snapshot) {
      return snapshot.docChanges().forEach(function (change) {
        if (change.type === 'removed') {
          deleteMessage(change.doc.id);
        } else {
          var message = change.doc.data();
          displayMessage(change.doc.id, message.timestamp, message.name, message.text, message.profilePicUrl, message.imageUrl);
        }
      });
    });
    document.querySelector('#container').classList.add('visible');
  };

  var room = window.location.hash.substring(1);

  if (room.length === 0) {
    var $modal = $('#no-stream-modal').modal({
      backdrop: 'static',
      keyboard: false
    });
    $('#form-submit-stream').submit(function (e) {
      e.preventDefault();
      var stream = document.querySelector('#stream-name').value;

      if (stream.length > 0) {
        history.pushState({}, stream, "#" + stream);
        $modal.on('hidden.bs.modal', function () {
          return buildRoom(stream);
        }).modal('hide');
      }
    });
  } else {
    buildRoom(room);
  }
})();
//# sourceMappingURL=main.js.map