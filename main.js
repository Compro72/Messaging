let connector = new Connector();

connector.onRoomChange = () => {
    const listContainer = document.getElementById("roomsList");

    listContainer.innerHTML = "";

    connector.roomIds.forEach(item => {
        const li = document.createElement("li");
        
        const textSpan = document.createElement("span");
        textSpan.textContent = item; // Removed the trailing space since the flexbox handles layout
        li.appendChild(textSpan);

        const joinButton = document.createElement("button");
        joinButton.textContent = "Join";
        
        // --- ADD THESE TWO LINES TO APPLY THE CSS CLASS ---
        joinButton.className = "btn-join"; 
        
        joinButton.onclick = () => {
            connector.joinRoom(item);
        };

        li.appendChild(joinButton);
        listContainer.appendChild(li);
    });

    document.getElementById("joinedRoom").textContent = "Currently Joined Room: " + connector.connectedRoom;
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