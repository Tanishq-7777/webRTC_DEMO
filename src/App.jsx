import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
const socket = io("https://greedless-shine-caloric.ngrok-free.dev", {
  extraHeaders: {
    "ngrok-skip-browser-warning": "true",
  },
  transports: ["websocket"], // skip polling, go straight to WS
});

const App = () => {
  const videoRef = useRef();
  const localStreamRef = useRef();
  const peerConnectionRef = useRef(null);
  const remoteVideoRef = useRef();

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [connected, setConnected] = useState(false);

  // top of file, but with the header fix

  const offerOptions = {
    iceRestart: true,
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  };

  const invokeUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      videoRef.current.srcObject = stream;
      localStreamRef.current = stream;
    } catch (error) {
      console.log(error.message);
    }
  };

  const rtcConfig = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
  };

  const createPeerConnection = () => {
    let peerConnection = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = peerConnection;

    localStreamRef.current.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStreamRef.current);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", event.candidate);
        console.log("ICE candidate:", event.candidate);
      }
    };

    peerConnection.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
      setConnected(true);
    };

    return peerConnection;
  };

  useEffect(() => {
    const init = async () => {
      await invokeUserMedia();
      socket.emit("join-room", { roomID: "room-1" });
      socket.on("user-joined", async () => {
        const peerConnection = createPeerConnection();
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit("offer", offer);
      });
      socket.on("offer", async (offer) => {
        const peerConnection = createPeerConnection();

        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer),
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("answer", answer);
      });

      socket.on("answer", async (answer) => {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
      });

      socket.on("ice-candidate", async (candidate) => {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate),
        );
      });
    };
    init();
    return () => {
      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  }, []);

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  };

  return (
    <div className="vc-root">
      <style>{styles}</style>

      <header className="vc-header">
        <div className="vc-brand">
          <span className="vc-logo-dot" />
          <h1>Live Call</h1>
        </div>
        <div className={`vc-status ${connected ? "online" : ""}`}>
          <span className="vc-status-dot" />
          {connected ? "Connected" : "Waiting for peer..."}
        </div>
      </header>

      <main className="vc-grid">
        <div className="vc-tile">
          <video ref={videoRef} autoPlay muted playsInline />
          <div className="vc-tile-label">
            You {!micOn && <span className="vc-muted-pill">muted</span>}
          </div>
        </div>

        <div className="vc-tile">
          <video ref={remoteVideoRef} autoPlay playsInline />
          {!connected && (
            <div className="vc-placeholder">
              <div className="vc-spinner" />
              <p>Waiting for the other person to join…</p>
            </div>
          )}
          <div className="vc-tile-label">Remote User</div>
        </div>
      </main>

      <footer className="vc-controls">
        <button
          className={`vc-btn ${micOn ? "" : "off"}`}
          onClick={toggleMic}
          aria-label="Toggle microphone"
        >
          {micOn ? "🎙️" : "🔇"}
        </button>
        <button
          className={`vc-btn ${camOn ? "" : "off"}`}
          onClick={toggleCam}
          aria-label="Toggle camera"
        >
          {camOn ? "📹" : "🚫"}
        </button>
        <button
          className="vc-btn end"
          onClick={() => window.location.reload()}
          aria-label="End call"
        >
          📞
        </button>
      </footer>
    </div>
  );
};

const styles = `
  * { box-sizing: border-box; }

  .vc-root {
    min-height: 100vh;
    background: radial-gradient(circle at 20% 20%, #1e293b 0%, #0b1120 60%, #060912 100%);
    color: #e2e8f0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    padding: clamp(12px, 3vw, 28px);
    gap: clamp(16px, 3vw, 28px);
  }

  .vc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  .vc-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .vc-logo-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: linear-gradient(135deg, #22d3ee, #6366f1);
    box-shadow: 0 0 16px rgba(99, 102, 241, 0.8);
  }

  .vc-header h1 {
    margin: 0;
    font-size: clamp(20px, 4vw, 30px);
    font-weight: 700;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #67e8f9, #a5b4fc);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .vc-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    padding: 8px 16px;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.12);
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .vc-status-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #f59e0b;
    animation: vc-pulse 1.6s infinite;
  }

  .vc-status.online .vc-status-dot {
    background: #10b981;
    animation: none;
  }

  @keyframes vc-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .vc-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(12px, 2.5vw, 24px);
  }

  .vc-tile {
    position: relative;
    background: #0f172a;
    border-radius: 20px;
    overflow: hidden;
    aspect-ratio: 16 / 10;
    border: 1px solid rgba(148, 163, 184, 0.15);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  }

  .vc-tile video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: #060912;
  }

  .vc-tile-label {
    position: absolute;
    bottom: 12px;
    left: 12px;
    padding: 6px 14px;
    background: rgba(15, 23, 42, 0.7);
    backdrop-filter: blur(8px);
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .vc-muted-pill {
    background: #ef4444;
    color: white;
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .vc-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: #94a3b8;
    font-size: 14px;
    text-align: center;
    padding: 20px;
  }

  .vc-spinner {
    width: 38px;
    height: 38px;
    border: 3px solid rgba(148, 163, 184, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: vc-spin 0.9s linear infinite;
  }

  @keyframes vc-spin {
    to { transform: rotate(360deg); }
  }

  .vc-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(12px, 3vw, 20px);
  }

  .vc-btn {
    width: clamp(52px, 12vw, 60px);
    height: clamp(52px, 12vw, 60px);
    border-radius: 50%;
    border: none;
    cursor: pointer;
    font-size: clamp(20px, 5vw, 24px);
    background: rgba(148, 163, 184, 0.15);
    border: 1px solid rgba(148, 163, 184, 0.25);
    transition: transform 0.15s ease, background 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .vc-btn:hover { transform: translateY(-3px); }
  .vc-btn:active { transform: scale(0.92); }

  .vc-btn.off {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .vc-btn.end {
    background: #ef4444;
    border-color: #ef4444;
  }

  .vc-btn.end:hover { background: #dc2626; }

  /* Mobile: stack the tiles vertically */
  @media (max-width: 720px) {
    .vc-grid {
      grid-template-columns: 1fr;
    }
    .vc-tile {
      aspect-ratio: 4 / 3;
    }
  }
`;

export default App;
