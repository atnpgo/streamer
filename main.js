"use strict";

var server = null; //if (window.location.protocol === 'http:')
//  server = "http://" + window.location.hostname + ":8088/janus";
//else

server = "https://stream.atnpgo.wtf:8089/janus";
var janus = null;
var screentest = null;
var opaqueId = "screensharingtest-" + Janus.randomString(12);
var myusername = null;
var myid = null;
var capture = null;
var role = null;
var room = null;
var source = null;
var spinner = null;

function checkEnterShare(field, event) {
  var theCode = event.keyCode ? event.keyCode : event.which ? event.which : event.charCode;

  if (theCode == 13) {
    preShareScreen();
    return false;
  } else {
    return true;
  }
}

function preShareScreen() {
  if (!Janus.isExtensionEnabled()) {
    alert("You're using Chrome but don't have the screensharing extension installed: click <b><a href='https://chrome.google.com/webstore/detail/janus-webrtc-screensharin/hapfgfdkleiggjjpfpenajgdnfckjpaj' target='_blank'>here</a></b> to do so");
    return;
  } // Create a new room


  if ($('#desc').val() === "") {
    alert("Please insert a description for the room");
    return;
  }

  capture = "screen";

  if (navigator.mozGetUserMedia) {
    // Firefox needs a different constraint for screen and window sharing
    capture = "window";
    shareScreen();
  } else {
    shareScreen();
  }
}

function shareScreen() {
  // Create a new room
  var desc = $('#desc').val();
  role = "publisher";
  var create = {
    "request": "create",
    "description": desc,
    "bitrate": 1000000,
    "publishers": 1
  };
  screentest.send({
    "message": create,
    success: function success(result) {
      var event = result["videoroom"];
      Janus.debug("Event: " + event);

      if (event != undefined && event != null) {
        // Our own screen sharing session has been created, join it
        room = result["room"];
        Janus.log("Screen sharing session created: " + room);
        myusername = randomString(12);
        var register = {
          "request": "join",
          "room": room,
          "ptype": "publisher",
          "display": myusername
        };
        screentest.send({
          "message": register
        });
        history.pushState({}, room, "#" + room);
        document.querySelector('#container').classList.add('visible');
        $('#no-stream-modal').modal('hide');
      }
    }
  });
}

function joinScreen(roomid) {
  // Join an existing screen sharing session
  if (isNaN(roomid)) {
    history.pushState({}, '', "");
    return;
  }

  room = parseInt(roomid);
  role = "listener";
  myusername = randomString(12);
  var register = {
    "request": "join",
    "room": room,
    "ptype": "listener",
    "display": myusername
  };
  screentest.send({
    "message": register
  });
  buildRoom(room);
}

function newRemoteFeed(id, display) {
  // A new feed has been published, create a new plugin handle and attach to it as a listener
  source = id;
  var remoteFeed = null;
  janus.attach({
    plugin: "janus.plugin.videoroom",
    opaqueId: opaqueId,
    success: function success(pluginHandle) {
      remoteFeed = pluginHandle;
      Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
      Janus.log("  -- This is a subscriber"); // We wait for the plugin to send us an offer

      var listen = {
        "request": "join",
        "room": room,
        "ptype": "listener",
        "feed": id
      };
      remoteFeed.send({
        "message": listen
      });
    },
    error: function error(_error) {
      Janus.error("  -- Error attaching plugin...", _error);
      alert("Error attaching plugin... " + _error);
    },
    onmessage: function onmessage(msg, jsep) {
      Janus.debug(" ::: Got a message (listener) :::");
      Janus.debug(msg);
      var event = msg["videoroom"];
      Janus.debug("Event: " + event);

      if (event != undefined && event != null) {
        if (event === "attached") {
          Janus.log("Successfully attached to feed " + id + " (" + display + ") in room " + msg["room"]);
          $('#screenmenu').toggleClass('d-flex d-none');
          $('#room').toggleClass('d-flex d-none');
        } else {// What has just happened?
        }
      }

      if (jsep !== undefined && jsep !== null) {
        Janus.debug("Handling SDP as well...");
        Janus.debug(jsep); // Answer and attach

        remoteFeed.createAnswer({
          jsep: jsep,
          media: {
            audioSend: false,
            videoSend: false
          },
          // We want recvonly audio/video
          success: function success(jsep) {
            Janus.debug("Got SDP!");
            Janus.debug(jsep);
            var body = {
              "request": "start",
              "room": room
            };
            remoteFeed.send({
              "message": body,
              "jsep": jsep
            });
          },
          error: function error(_error2) {
            Janus.error("WebRTC error:", _error2);
            alert("WebRTC error... " + _error2);
          }
        });
      }
    },
    onlocalstream: function onlocalstream(stream) {// The subscriber stream is recvonly, we don't expect anything here
    },
    onremotestream: function onremotestream(stream) {
      if ($('#screenvideo').length === 0) {
        // No remote video yet
        $('#screencapture').append('<video class="rounded centered" id="waitingvideo" width="100%" height="100%" />');
        $('#screencapture').append('<video class="rounded centered hide" id="screenvideo" width="100%" height="100%" autoplay playsinline/>'); // Show the video, hide the spinner and show the resolution when we get a playing event

        $("#screenvideo").bind("playing", function () {
          $('#waitingvideo').remove();
          $('#screenvideo').removeClass('hide');
          if (spinner !== null && spinner !== undefined) spinner.stop();
          spinner = null;
        });
      }

      Janus.attachMediaStream($('#screenvideo').get(0), stream);
    },
    oncleanup: function oncleanup() {
      Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
      $('#waitingvideo').remove();
      if (spinner !== null && spinner !== undefined) spinner.stop();
      spinner = null;
    }
  });
} // Just an helper to generate random usernames


function randomString(len, charSet) {
  charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var randomString = '';

  for (var i = 0; i < len; i++) {
    var randomPoz = Math.floor(Math.random() * charSet.length);
    randomString += charSet.substring(randomPoz, randomPoz + 1);
  }

  return randomString;
}

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
};

Janus.init({
  debug: "all",
  callback: function callback() {
    // Use a button to start the demo
    // Make sure the browser supports WebRTC
    if (!Janus.isWebrtcSupported()) {
      alert("No WebRTC support... ");
      return;
    } // Create session


    janus = new Janus({
      server: server,
      success: function success() {
        // Attach to video room test plugin
        janus.attach({
          plugin: "janus.plugin.videoroom",
          opaqueId: opaqueId,
          success: function success(pluginHandle) {
            $('#details').remove();
            screentest = pluginHandle;

            if (room.length > 0) {
              joinScreen(room);
            }

            Janus.log("Plugin attached! (" + screentest.getPlugin() + ", id=" + screentest.getId() + ")");
            $('#create').click(preShareScreen);
            $('#desc').focus();
          },
          error: function error(_error3) {
            Janus.error("  -- Error attaching plugin...", _error3);
            alert("Error attaching plugin... " + _error3);
          },
          consentDialog: function consentDialog(on) {
            Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
          },
          webrtcState: function webrtcState(on) {
            Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");

            if (on) {
              //alert("Your screen sharing session just started: pass the " + room + "session identifier to those who want to attend.");
              buildRoom(room);
            } else {
              alert("Your screen sharing session just stopped.");
              janus.destroy();
            }
          },
          onmessage: function onmessage(msg, jsep) {
            Janus.debug(" ::: Got a message (publisher) :::");
            Janus.debug(msg);
            var event = msg["videoroom"];
            Janus.debug("Event: " + event);

            if (event != undefined && event != null) {
              if (event === "joined") {
                myid = msg["id"];
                $('#session').html(room);
                $('#title').html(msg["description"]);
                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);

                if (role === "publisher") {
                  // This is our session, publish our stream
                  Janus.debug("Negotiating WebRTC stream for our screen (capture " + capture + ")");
                  screentest.createOffer({
                    media: {
                      video: capture,
                      audioSend: true,
                      videoRecv: false
                    },
                    // Screen sharing Publishers are sendonly
                    success: function success(jsep) {
                      Janus.debug("Got publisher SDP!");
                      Janus.debug(jsep);
                      var publish = {
                        "request": "configure",
                        "audio": true,
                        "video": true
                      };
                      screentest.send({
                        "message": publish,
                        "jsep": jsep
                      });
                    },
                    error: function error(_error4) {
                      Janus.error("WebRTC error:", _error4);
                      alert("WebRTC error... " + JSON.stringify(_error4));
                    }
                  });
                } else {
                  // We're just watching a session, any feed to attach to?
                  if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    var list = msg["publishers"];
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list);

                    for (var f in list) {
                      var id = list[f]["id"];
                      var display = list[f]["display"];
                      Janus.debug("  >> [" + id + "] " + display);
                      newRemoteFeed(id, display);
                    }
                  }
                }
              } else if (event === "event") {
                // Any feed to attach to?
                if (role === "listener" && msg["publishers"] !== undefined && msg["publishers"] !== null) {
                  var list = msg["publishers"];
                  Janus.debug("Got a list of available publishers/feeds:");
                  Janus.debug(list);

                  for (var f in list) {
                    var id = list[f]["id"];
                    var display = list[f]["display"];
                    Janus.debug("  >> [" + id + "] " + display);
                    newRemoteFeed(id, display);
                  }
                } else if (msg["leaving"] !== undefined && msg["leaving"] !== null) {
                  // One of the publishers has gone away?
                  var leaving = msg["leaving"];
                  Janus.log("Publisher left: " + leaving);

                  if (role === "listener" && msg["leaving"] === source) {
                    alert("The screen sharing session is over, the publisher left");
                  }
                } else if (msg["error"] !== undefined && msg["error"] !== null) {
                  alert(msg["error"]);
                }
              }
            }

            if (jsep !== undefined && jsep !== null) {
              Janus.debug("Handling SDP as well...");
              Janus.debug(jsep);
              screentest.handleRemoteJsep({
                jsep: jsep
              });
            }
          },
          onlocalstream: function onlocalstream(stream) {
            Janus.debug(" ::: Got a local stream :::");
            Janus.debug(stream);
            $('#screenmenu').toggleClass('d-flex d-none');
            $('#room').toggleClass('d-flex d-none');

            if ($('#screenvideo').length === 0) {
              $('#screencapture').append('<video class="rounded centered" id="screenvideo" width="100%" height="100%" autoplay playsinline muted="muted"/>');
            }

            Janus.attachMediaStream($('#screenvideo').get(0), stream);
          },
          onremotestream: function onremotestream(stream) {// The publisher stream is sendonly, we don't expect anything here
          },
          oncleanup: function oncleanup() {
            Janus.log(" ::: Got a cleanup notification :::");
            $('#screencapture').empty();
            $('#room').toggleClass('d-flex d-none');
          }
        });
      },
      error: function error(_error5) {
        Janus.error(_error5);
        alert(_error5);
      },
      destroyed: function destroyed() {
      }
    });
  }
});
room = window.location.hash.substring(1);

if (room.length === 0) {
  $('#no-stream-modal').modal({
    backdrop: 'static',
    keyboard: false
  });
}
//# sourceMappingURL=main.js.map
