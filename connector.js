class Connector {
    constructor() {
        this.socket = new WebSocket("wss://p2p-network-cld3.onrender.com/");

        this.onDataReceived = (data) => { };

        this.socket.onmessage = (event) => {
            this.onDataReceived(event.data);
        };
    }

    send(message) {
        this.socket.send(message);
    }
}