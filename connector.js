class Connector {
    constructor() {
        let sessionId = sessionStorage.getItem('p2p_session_id');
        if (!sessionId) {
            sessionId = 'peer_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            sessionStorage.setItem('p2p_session_id', sessionId);
        }

        const wsUrl = `wss://p2p-network-cld3.onrender.com/?sessionId=${sessionId}`;
        
        this.socket = new WebSocket(wsUrl);
        this.packageQueue = [];

        this.onDataReceived = (data) => { };

        this.socket.onopen = () => {
            while (this.packageQueue.length > 0) {
                const msg = this.packageQueue.shift();
                this.socket.send(msg);
            }
        };

        this.socket.onmessage = (event) => {
            this.onDataReceived(event.data);
        };
    }

    send(message) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(message);
        } else {
            this.packageQueue.push(message);
        }
    }
}