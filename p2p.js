class P2PDataChannels {
	constructor(connector) {
		this.devices = {};
		this.dataChannels = {};
		this.isInitiator = {};
		this.iceCandidateQueue = {};

		this.connector = connector;

		this.connector.onDataReceived = (data) => {
			this.process(data);
		};

		this.onDataReceived = (data, remoteId) => { };
	}

	async process(data) {
		let received = JSON.parse(data);

		let remoteId = received.targetPeerId;

		if (received.type == "role") {
			await this.initialize(received.message, remoteId);
		} else if (received.type == "sdp") {
			await this.devices[remoteId].setRemoteDescription(new RTCSessionDescription(received.message));

			while (this.iceCandidateQueue[remoteId] && this.iceCandidateQueue[remoteId].length > 0) {
				const cand = this.iceCandidateQueue[remoteId].shift();
				await this.devices[remoteId].addIceCandidate(cand).catch(e => console.error(e));
			}

			if (!this.isInitiator[remoteId]) {
				await this.createAnswer(remoteId);
			}

		} else if (received.type == "iceCandidate") {
			const candidate = new RTCIceCandidate(received.message);

			if (!this.devices[remoteId] || !this.devices[remoteId].remoteDescription) {
				if (!this.iceCandidateQueue[remoteId]) this.iceCandidateQueue[remoteId] = [];
				this.iceCandidateQueue[remoteId].push(candidate);
			} else {
				try {
					await this.devices[remoteId].addIceCandidate(candidate);
				} catch (e) {
					console.error("Error adding received ICE candidate", e);
				}
			}

		} else if (received.type == "peerLeft") {
			this.closePeerConnection(remoteId);
		}
	}

	async initialize(role, remoteId) {
		this.devices[remoteId] = new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
		});

		this.iceCandidateQueue[remoteId] = [];

		this.devices[remoteId].onicecandidate = ({ candidate }) => {
			if (candidate) {
				this.connector.send(JSON.stringify({
					type: "iceCandidate",
					message: candidate,
					targetPeerId: remoteId
				}));
			}
		};

		if (role == "initiator") {
			this.isInitiator[remoteId] = true;
			await this.createOffer(remoteId);
		} else {
			this.isInitiator[remoteId] = false;

			// Listen for the incoming data channel on the answerer side
			this.devices[remoteId].ondatachannel = (event) => {
				this.dataChannels[remoteId] = event.channel;
				this.dataChannels[remoteId].onmessage = (event) => this.onDataReceived(event.data, remoteId);
			};
		}
	}

	async createOffer(remoteId) {
		this.dataChannels[remoteId] = this.devices[remoteId].createDataChannel("dataChannel");
		this.dataChannels[remoteId].onmessage = (event) => this.onDataReceived(event.data, remoteId);

		const offer = await this.devices[remoteId].createOffer();
		await this.devices[remoteId].setLocalDescription(offer);

		this.connector.send(JSON.stringify({
			type: "sdp",
			message: this.devices[remoteId].localDescription,
			targetPeerId: remoteId
		}));
	}

	async createAnswer(remoteId) {
		const answer = await this.devices[remoteId].createAnswer();
		await this.devices[remoteId].setLocalDescription(answer);

		this.connector.send(JSON.stringify({
			type: "sdp",
			message: this.devices[remoteId].localDescription,
			targetPeerId: remoteId
		}));
	}

	broadcastData(data) {
		Object.keys(this.dataChannels).forEach((remoteId) => {
			this.sendDataToPeer(remoteId, data);
		});
	}

	sendDataToPeer(remoteId, data) {
		const dc = this.dataChannels[remoteId];
		if (this.dataChannels[remoteId] && this.dataChannels[remoteId].readyState == "open") {
			dc.send(JSON.stringify(data));
		} else {
			console.warn(`Data channel for peer ${remoteId} is not open.`);
		}
	}

	closePeerConnection(remoteId) {
		if (this.dataChannels[remoteId]) {
			this.dataChannels[remoteId].close();
		}

		if (this.devices[remoteId]) {
			this.devices[remoteId].close();
		}

		delete this.devices[remoteId];
		delete this.dataChannels[remoteId];
		delete this.isInitiator[remoteId];
		delete this.iceCandidateQueue[remoteId];
	}
}