let connector = new Connector();

connector.onRoomsListChange = () => {
    const listContainer = document.getElementById("roomsList");

    listContainer.innerHTML = "";

    connector.roomIds.forEach(item => {
        const li = document.createElement("li");

        const textSpan = document.createElement("span");
        textSpan.textContent = item;
        li.appendChild(textSpan);

        const joinButton = document.createElement("button");
        joinButton.textContent = "Join";

        joinButton.className = "btn-join";

        joinButton.onclick = () => {
            connector.joinRoom(item);
        };

        li.appendChild(joinButton);
        listContainer.appendChild(li);
    });
}

connector.onRoomJoinStatusChange = () => {
    updateView();
}

let channels = new P2PDataChannels(connector);

channels.onDataReceived = (data, remoteId) => {
    const messagesList = document.getElementById('messagesList');
    const listItem = document.createElement('li');
    listItem.textContent = remoteId + ": " + JSON.parse(data);
    messagesList.appendChild(listItem);
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    if (input.value) {
        channels.broadcastData(JSON.stringify(input.value));
        input.value = '';
    }
}

function createRoom() {
    connector.createRoom();
}

function leaveRoom() {
    connector.leaveRoom();
}

connector.onopen = (originalOnOpen => {
    return () => {
        if (originalOnOpen) originalOnOpen();
        document.getElementById("myId").textContent = channels.id;
    };
})(connector.onopen);

channels.onPeerConnected = (remoteId) => {
    updateView();
};

channels.onPeerDisconnected = (remoteId) => {
    updateView();
};


function updateView() {
    const hasJoinedRoom = connector.connectedRoom && connector.connectedRoom !== "null";

    if (hasJoinedRoom) {
        document.getElementById("joinedRoom").innerHTML = `<span>${connector.connectedRoom}</span>`;
        document.body.className = "room-view";
    } else {
        document.getElementById("joinedRoom").innerHTML = `<span class="null-text">null</span>`;
        document.body.className = "lobby-view";

        document.getElementById("messagesList").innerHTML = "";
    }

    if (hasJoinedRoom) {
        const host = channels.hostId || "Determining...";
        const hostBadge = document.getElementById("hostId");

        if (channels.isHost()) {
            hostBadge.textContent = `${host} (You)`;
            hostBadge.style.borderColor = "var(--color-success)";
        } else {
            hostBadge.textContent = host;
            hostBadge.style.borderColor = "rgba(255, 255, 255, 0.1)";
        }
    }
}