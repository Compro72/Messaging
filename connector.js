class Connector {
    constructor() {
        this.socket = new WebSocket("wss://p2p-network-cld3.onrender.com/");
        this.connectedRoom = null;
        this.roomIds = [];

        this.onopen = () => { };
        this.socket.onopen = () => {
            this.onopen();
        };

        this.onPeerDataReceived = (data) => { };
        this.onRoomsListChange = () => { };
        this.onRoomJoinStatusChange = () => { };
        this.onRoomLeft = () => { };
        this.socket.onmessage = (event) => {
            let received = JSON.parse(event.data);

            console.log(received)

            if (received.type === "roomCreated") {
                this.roomIds.push(received.roomId);
                this.onRoomsListChange();
            } else if (received.type === "roomClosed") {
                this.roomIds = this.roomIds.filter((value) => {
                    return value != received.roomId;
                });
                this.onRoomsListChange();
            } else if (received.type === "roomJoined") {
                this.connectedRoom = received.roomId;
                this.onRoomJoinStatusChange();
            } else if (received.type === "peerMessage") {
                this.onPeerDataReceived(event.data);
            }
        };
    }

    createRoom() {
        if (!this.connectedRoom) {
            this.send(JSON.stringify({
                type: "createRoom"
            }));
        }
    }

    joinRoom(roomId) {
        if (!this.connectedRoom) {
            this.send(JSON.stringify({
                type: "connectRoom",
                roomId: roomId
            }));
        }
    }

    leaveRoom() {
        if (this.connectedRoom) {
            this.send(JSON.stringify({
                type: "disconnectRoom"
            }));
            this.connectedRoom = null;
            this.onRoomJoinStatusChange();
            this.onRoomLeft();
        }
    }

    send(message) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(message);
        }
    }
}