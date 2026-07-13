class P2PDataChannels {
	constructor(connector) {
		this.id;
		this.devices = {};
		this.dataChannels = {};
		this.isInitiator = {};
		this.iceCandidateQueue = {};

		this.connector = connector;

		this.connector.onDataReceived = (data) => {
			this.process(data);
		};

		this.onDataReceived = (data, remoteId) => { };
		this.onPeerConnected = (remoteId) => { };
		this.onPeerDisconnected = (remoteId) => { };
	}

	async process(data) {
		let received = JSON.parse(data);

		if (received.type == "id") {
			this.id = received.message;
			console.log(this.id);
			console.log(JSON.parse(JSON.stringify(this)));

			this.connector.send(JSON.stringify({
				type: "connectAll"
			}));
		} else if (received.type == "role") {
			await this.initialize(received.message, received.remoteId);
		} else if (received.type == "sdp") {
			if (!this.devices[received.remoteId]) return;

			await this.devices[received.remoteId].setRemoteDescription(new RTCSessionDescription(received.message));

			while (this.iceCandidateQueue[received.remoteId] && this.iceCandidateQueue[received.remoteId].length > 0) {
				const candidate = this.iceCandidateQueue[received.remoteId].shift();
				await this.devices[received.remoteId].addIceCandidate(candidate);
			}

			if (!this.isInitiator[received.remoteId]) {
				await this.createAnswer(received.remoteId);
			}

		} else if (received.type == "iceCandidate") {
			const candidate = new RTCIceCandidate(received.message);

			if (!this.devices[received.remoteId] || !this.devices[received.remoteId].remoteDescription) {
				if (!this.iceCandidateQueue[received.remoteId]) this.iceCandidateQueue[received.remoteId] = [];
				this.iceCandidateQueue[received.remoteId].push(candidate);
			} else {
				await this.devices[received.remoteId].addIceCandidate(candidate);
			}
		} else if (received.type == "peerLeft") {

		}
	}

	async initialize(role, remoteId) {
		console.log(remoteId);

		this.iceCandidateQueue[remoteId] = [];

		this.devices[remoteId] = new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
		});

		this.devices[remoteId].onconnectionstatechange = () => {
			const pc = this.devices[remoteId];
			if (!pc) return;

			const state = pc.connectionState;
			if (state === "disconnected" || state === "failed" || state === "closed") {
				this.closePeerConnection(remoteId);
			}
		};

		this.devices[remoteId].onicecandidate = ({ candidate }) => {
			if (candidate) {
				this.connector.send(JSON.stringify({
					type: "iceCandidate",
					message: candidate,
					remoteId: remoteId
				}));
			}
		};

		if (role == "initiator") {
			this.isInitiator[remoteId] = true;
			await this.createOffer(remoteId);
		} else {
			this.isInitiator[remoteId] = false;

			this.devices[remoteId].ondatachannel = (event) => {
				this.setupDataChannel(remoteId, event.channel);
			};
		}
	}

	setupDataChannel(remoteId, channel) {
		this.dataChannels[remoteId] = channel;
		channel.onmessage = (event) => this.onDataReceived(event.data, remoteId);

		channel.onopen = () => {
			this.onPeerConnected(remoteId);
		};

		channel.onclose = () => {
			this.closePeerConnection(remoteId);
		};
	}

	async createOffer(remoteId) {
		const channel = this.devices[remoteId].createDataChannel("dataChannel");
		this.setupDataChannel(remoteId, channel);

		const offer = await this.devices[remoteId].createOffer();
		await this.devices[remoteId].setLocalDescription(offer);

		this.connector.send(JSON.stringify({
			type: "sdp",
			message: this.devices[remoteId].localDescription,
			remoteId: remoteId
		}));
	}

	async createAnswer(remoteId) {
		const answer = await this.devices[remoteId].createAnswer();
		await this.devices[remoteId].setLocalDescription(answer);

		this.connector.send(JSON.stringify({
			type: "sdp",
			message: this.devices[remoteId].localDescription,
			remoteId: remoteId
		}));
	}

	broadcastData(data) {
		Object.keys(this.dataChannels).forEach((remoteId) => {
			this.sendDataToPeer(remoteId, data);
		});
	}

	sendDataToPeer(remoteId, data) {
		if (this.dataChannels[remoteId] && this.dataChannels[remoteId].readyState == "open") {
			this.dataChannels[remoteId].send(data);
		} else {
			this.closePeerConnection(remoteId);
		}
	}

	closePeerConnection(remoteId) {
		if (!this.devices[remoteId] && !this.dataChannels[remoteId]) return;

		if (this.dataChannels[remoteId]) {
			this.dataChannels[remoteId].onopen = null;
			this.dataChannels[remoteId].onclose = null;
			this.dataChannels[remoteId].onmessage = null;
			this.dataChannels[remoteId].close();
		}

		if (this.devices[remoteId]) {
			this.devices[remoteId].onicecandidate = null;
			this.devices[remoteId].onconnectionstatechange = null;
			this.devices[remoteId].ondatachannel = null;
			this.devices[remoteId].close();
		}

		delete this.devices[remoteId];
		delete this.dataChannels[remoteId];
		delete this.isInitiator[remoteId];
		delete this.iceCandidateQueue[remoteId];

		this.onPeerDisconnected(remoteId);
	}
}