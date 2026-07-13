let connector = new Connector();

let channels = new P2PDataChannels(connector);

channels.onDataReceived = (data, remoteId) => {
    const messagesList = document.getElementById('messagesList');
    const listItem = document.createElement('li');
    listItem.textContent = remoteId + ": " + JSON.parse(data);
    messagesList.appendChild(listItem);
}

function sendMessage() {
    channels.broadcastData(JSON.stringify("ping"));
}