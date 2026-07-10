let connector = new Connector();

let channels = new P2PDataChannels(connector);

channels.onDataReceived = (data, remoteId) => {
    const messagesList = document.getElementById('messagesList');
    const listItem = document.createElement('li');
    listItem.textContent = remoteId + ": " + data;
    messagesList.appendChild(listItem);
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    if (input.value) {
        channels.broadcastData(input.value);
        input.value = '';
    }
}