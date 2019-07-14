(() => {
    const buildRoom = room => {
        $('source').attr('src', 'hls/' + room + '.m3u8');
        const player = videojs('#player', {
            autoplay: 'any',
            plugins: {
                airplayButton: {}
            }
        });

        player.hlsQualitySelector();
        videojs.addLanguage('en', {"The media could not be loaded, either because the server or network failed or because the format is not supported.": "Stream is currently offline, check back later."});

        const addSizeToGoogleProfilePic = url => url.indexOf('googleusercontent.com') !== -1 && url.indexOf('?') === -1 ? url + '?sz=150' : url;
        const getProfilePicUrl = () => firebase.auth().currentUser.photoURL || 'profile_placeholder.png';
        const getUserName = () => firebase.auth().currentUser.displayName;

        const saveMessage = messageText => firebase.firestore().collection(room).add({
            name: getUserName(),
            text: messageText,
            profilePicUrl: getProfilePicUrl(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(error => console.error('Error writing new message to Firebase Database', error));

        const saveImageMessage = file => firebase.firestore().collection(room).add({
            name: getUserName(),
            imageUrl: 'https://www.google.com/images/spin-32.gif?a',
            profilePicUrl: getProfilePicUrl(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(messageRef => firebase.storage().ref(firebase.auth().currentUser.uid + '/' + messageRef.id + '/' + file.name).put(file)
            .then(fileSnapshot => fileSnapshot.ref.getDownloadURL()
                .then(url => messageRef.update({
                    imageUrl: url,
                    storageUri: fileSnapshot.metadata.fullPath
                })))).catch(error => console.error('There was an error uploading a file to Cloud Storage:', error));

        const deleteMessage = id => {
            const div = document.getElementById(id);
            if (div) {
                div.parentNode.removeChild(div);
            }
        };

        const displayMessage = (id, timestamp, name, text, picUrl, imageUrl) => {
            const messageListElement = document.querySelector('.chat');
            let div = document.getElementById(id);
            // If an element for that message does not exists yet we create it.
            if (!div) {
                const container = document.createElement('div');
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
            const messageElement = div.querySelector('.message');
            if (text) { // If the message is text.
                messageElement.textContent = text;
                // Replace all line breaks by <br>.
                messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
            } else if (imageUrl) { // If the message is an image.
                const image = document.createElement('img');
                image.addEventListener('load', () => messageListElement.scrollTop = messageListElement.scrollHeight);
                image.src = imageUrl + '&' + new Date().getTime();
                messageElement.innerHTML = '';
                messageElement.appendChild(image);
            }
            // Show the card fading-in and scroll to view the new message.
            setTimeout(() => div.classList.add('visible'), 1);
            messageListElement.scrollTop = messageListElement.scrollHeight;
            document.querySelector('input').focus();
        };

        const $btnSignIn = $('#btn-sign-in').click(() => firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()));
        const $btnSignOut = $('#btn-sign-out').click(() => firebase.auth().signOut());

        $btnSignOut.hide();
        $btnSignIn.show();
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                $btnSignOut.show();
                $btnSignIn.hide();
                $('input').removeAttr('disabled').attr('placeholder', 'Message');
                $('#form-send-message button').removeAttr('disabled');
                document.querySelector('#name').innerHTML = getUserName();
                document.querySelector('#pfp').src = addSizeToGoogleProfilePic(getProfilePicUrl());
            } else {
                $btnSignOut.hide();
                $btnSignIn.show();
                $('input').attr('disabled', 'disabled').attr('placeholder', 'Please sign in to send messages');
                $('#form-send-message button').attr('disabled', 'disabled');
                document.querySelector('#name').innerHTML = 'Please sign in <i class="fas fa-arrow-right"></i>';
                document.querySelector('#pfp').src = 'profile_placeholder.png';
            }
        });
        $('#btn-add-image').click(e => {
            e.preventDefault();
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/png, image/jpeg, image/gif';
            input.onchange = e => {
                const file = e.target.files[0];
                if (!file.type.match('image.*')) {
                    alert('You can only share images');
                    return;
                }
                saveImageMessage(file)
            };
            input.click();
        });

        $('#form-send-message').submit(e => {
            e.preventDefault();
            e.stopPropagation();
            const message = e.currentTarget.querySelector('input').value;
            e.currentTarget.querySelector('input').value = '';
            saveMessage(message);
        });

        const toggle = () => $('.fa-expand-arrows-alt,.fa-compress-arrows-alt').toggleClass('fa-expand-arrows-alt fa-compress-arrows-alt');
        document.addEventListener('fullscreenchange', toggle, false);
        document.addEventListener('webkitfullscreenchange', toggle, false);
        document.addEventListener('mozfullscreenchange', toggle, false);
        document.addEventListener('msfullscreenchange', toggle, false);
        const active = () => {
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

        const $btnFullscreen = $('#btn-fullscreen').click(() => {
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

        const query = firebase.firestore()
            .collection(room)
            .orderBy('timestamp', 'asc')
            .limit(25);
        query.onSnapshot(snapshot => snapshot.docChanges().forEach(change => {
            if (change.type === 'removed') {
                deleteMessage(change.doc.id);
            } else {
                const message = change.doc.data();
                displayMessage(change.doc.id, message.timestamp, message.name, message.text, message.profilePicUrl, message.imageUrl);
            }
        }));
        document.querySelector('#container').classList.add('visible');
    };

    const room = window.location.hash.substring(1);
    if (room.length === 0) {
        const $modal = $('#no-stream-modal').modal({
            backdrop: 'static',
            keyboard: false
        });
        $('#form-submit-stream').submit(e => {
            e.preventDefault();
            const stream = document.querySelector('#stream-name').value;
            if (stream.length > 0) {
                history.pushState({}, stream, "#" + stream);
                $modal.on('hidden.bs.modal', () => buildRoom(stream)).modal('hide')
            }
        });
    } else {
        buildRoom(room);
    }
})();