class P2PDataChannels {
	constructor(connector) {
		this.id;
		this.devices = {};
		this.dataChannels = {};
		this.isInitiator = {};
		this.iceCandidateQueue = {};

		this.connector = connector;

		this.connector.onopen = () => {
			this.id = sessionStorage.getItem("p2p_session_id");
			if (!this.id) {
				this.id = "peer_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
				sessionStorage.setItem("p2p_session_id", this.id);
			}

			this.connector.send(JSON.stringify({
				type: "initId",
				id: this.id
			}));
		}

		this.connector.onPeerDataReceived = (data) => {
			this.process(data);
		};

		this.connector.onRoomLeft = () => {
			this.devices = {};
			this.dataChannels = {};
			this.isInitiator = {};
			this.iceCandidateQueue = {};
		};

		this.onDataReceived = (data, remoteId) => { };
		this.onPeerConnected = (remoteId) => { };
		this.onPeerDisconnected = (remoteId) => { };
	}

	async process(data) {
		let received = JSON.parse(data);

		let peerMessageType = received.peerMessageType;
		let remoteId = received.remoteId;

		if (peerMessageType === "role") {
			await this.initialize(received.role, remoteId);
		} else if (peerMessageType === "sdp") {
			if (!this.devices[remoteId]) return;

			await this.devices[remoteId].setRemoteDescription(new RTCSessionDescription(received.sdp));

			while (this.iceCandidateQueue[remoteId] && this.iceCandidateQueue[remoteId].length > 0) {
				const candidate = this.iceCandidateQueue[remoteId].shift();
				await this.devices[remoteId].addIceCandidate(candidate);
			}

			if (!this.isInitiator[remoteId]) {
				await this.createAnswer(remoteId);
			}

		} else if (peerMessageType === "iceCandidate") {
			const candidate = new RTCIceCandidate(received.candidate);

			if (!this.devices[remoteId] || !this.devices[remoteId].remoteDescription) {
				if (!this.iceCandidateQueue[remoteId]) this.iceCandidateQueue[remoteId] = [];
				this.iceCandidateQueue[remoteId].push(candidate);
			} else {
				await this.devices[remoteId].addIceCandidate(candidate);
			}
		}
	}

	async initialize(role, remoteId) {
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
					type: "peerMessage",
					peerMessageType: "iceCandidate",
					candidate: candidate,
					targetId: remoteId,
					remoteId: this.id
				}));
			}
		};

		if (role === "initiator") {
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
			type: "peerMessage",
			peerMessageType: "sdp",
			sdp: this.devices[remoteId].localDescription,
			targetId: remoteId,
			remoteId: this.id
		}));
	}

	async createAnswer(remoteId) {
		const answer = await this.devices[remoteId].createAnswer();
		await this.devices[remoteId].setLocalDescription(answer);

		this.connector.send(JSON.stringify({
			type: "peerMessage",
			peerMessageType: "sdp",
			sdp: this.devices[remoteId].localDescription,
			targetId: remoteId,
			remoteId: this.id
		}));
	}

	broadcastData(data) {
		Object.keys(this.dataChannels).forEach((remoteId) => {
			this.sendDataToPeer(remoteId, data);
		});
	}

	sendDataToPeer(remoteId, data) {
		if (this.dataChannels[remoteId] && this.dataChannels[remoteId].readyState === "open") {
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