import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://greedless-shine-caloric.ngrok-free.dev", {
  extraHeaders: {
    "ngrok-skip-browser-warning": "true",
  },
  transports: ["websocket"],
});

const App = () => {
  const videoRef = useRef();
  const localStreamRef = useRef();
  const peerConnectionRef = useRef(null);
  const remoteVideoRef = useRef();

  const [connected, setConnected] = useState(false);

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
      { urls: "stun:stun.relay.metered.ca:80" },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "605292ff03fb8440dfba4574",
        credential: "qSUoh2356eLphMuW",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "605292ff03fb8440dfba4574",
        credential: "qSUoh2356eLphMuW",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "605292ff03fb8440dfba4574",
        credential: "qSUoh2356eLphMuW",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "605292ff03fb8440dfba4574",
        credential: "qSUoh2356eLphMuW",
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
      }
    };

    peerConnection.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
      setConnected(true);
    };

    return peerConnection;
  };

  const cleanupAndRejoin = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setConnected(false);

    socket.disconnect();
    socket.connect();
    socket.once("connect", () => {
      socket.emit("join-room");
    });
  };

  useEffect(() => {
    const init = async () => {
      await invokeUserMedia();
      socket.emit("join-room");

      socket.on("matched", async ({ role }) => {
        if (role === "caller") {
          const peerConnection = createPeerConnection();
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          socket.emit("offer", offer);
        }
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

      socket.on("peer-left", () => {
        cleanupAndRejoin();
      });
    };

    init();

    return () => {
      socket.off("matched");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("peer-left");
    };
  }, []);

  return (
    <div className="vc-root">
      <style>{styles}</style>

      <div className="vc-glow vc-glow-1" />
      <div className="vc-glow vc-glow-2" />

      <header className="vc-header">
        <div className="vc-brand">
          <span className="vc-logo-dot" />
          <h1>ChitChat</h1>
        </div>
        <div className={`vc-status ${connected ? "online" : ""}`}>
          <span className="vc-status-dot" />
          {connected ? "Connected" : "Searching for a stranger…"}
        </div>
      </header>

      <main className="vc-grid">
        <div className="vc-tile">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="mirrored"
          />
          <div className="vc-tile-label">You</div>
        </div>

        <div className="vc-tile">
          <video ref={remoteVideoRef} autoPlay playsInline />
          {!connected && (
            <div className="vc-placeholder">
              <div className="vc-spinner" />
              <p>Looking for someone to connect you with…</p>
            </div>
          )}
          <div className="vc-tile-label">Stranger</div>
        </div>
      </main>

      <footer className="vc-controls">
        <button
          className="vc-next-btn"
          onClick={cleanupAndRejoin}
          aria-label="Next stranger"
        >
          <span>Next</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 5L13 12L5 19"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M13 5L21 12L13 19"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </footer>
    </div>
  );
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; }

  .vc-root {
    position: relative;
    min-height: 100vh;
    overflow: hidden;
    background: #07080d;
    color: #f1f3f9;
    font-family: 'Outfit', system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    padding: clamp(16px, 3vw, 32px);
    gap: clamp(20px, 3vw, 32px);
  }

  .vc-glow {
    position: absolute;
    width: 520px;
    height: 520px;
    border-radius: 50%;
    filter: blur(120px);
    opacity: 0.35;
    pointer-events: none;
    z-index: 0;
  }
  .vc-glow-1 {
    top: -180px;
    left: -120px;
    background: radial-gradient(circle, #6d5dfc, transparent 70%);
  }
  .vc-glow-2 {
    bottom: -200px;
    right: -140px;
    background: radial-gradient(circle, #1fd1c1, transparent 70%);
  }

  .vc-header {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  .vc-brand { display: flex; align-items: center; gap: 10px; }

  .vc-logo-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: linear-gradient(135deg, #8b7bff, #1fd1c1);
    box-shadow: 0 0 18px rgba(139, 123, 255, 0.7);
  }

  .vc-header h1 {
    margin: 0;
    font-size: clamp(20px, 3.4vw, 26px);
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  .vc-status {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 13.5px;
    font-weight: 500;
    padding: 9px 18px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.045);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    color: rgba(241, 243, 249, 0.75);
  }

  .vc-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f5a623;
    box-shadow: 0 0 10px rgba(245, 166, 35, 0.7);
    animation: vc-pulse 1.6s infinite;
  }

  .vc-tile video.mirrored {
    transform: scaleX(-1);
  }
  .vc-status.online .vc-status-dot {
    background: #2ee6a8;
    box-shadow: 0 0 10px rgba(46, 230, 168, 0.8);
    animation: none;
  }
  .vc-status.online { color: rgba(241, 243, 249, 0.95); }

  @keyframes vc-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  .vc-grid {
    position: relative;
    z-index: 1;
    flex: 1;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(14px, 2.5vw, 26px);
  }

  .vc-tile {
    position: relative;
    background: #0c0e16;
    border-radius: 28px;
    overflow: hidden;
    aspect-ratio: 16 / 10;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
      0 30px 70px rgba(0, 0, 0, 0.55),
      inset 0 0 0 1px rgba(255, 255, 255, 0.02);
  }

  .vc-tile video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: #07080d;
  }

  .vc-tile-label {
    position: absolute;
    bottom: 14px;
    left: 14px;
    padding: 7px 15px;
    background: rgba(7, 8, 13, 0.55);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    font-size: 12.5px;
    font-weight: 500;
    letter-spacing: 0.2px;
  }

  .vc-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    color: rgba(241, 243, 249, 0.55);
    font-size: 14px;
    text-align: center;
    padding: 24px;
    background: radial-gradient(circle at 50% 40%, rgba(109, 93, 252, 0.08), transparent 65%);
  }

  .vc-spinner {
    width: 36px;
    height: 36px;
    border: 2.5px solid rgba(255, 255, 255, 0.1);
    border-top-color: #8b7bff;
    border-radius: 50%;
    animation: vc-spin 0.85s linear infinite;
  }

  @keyframes vc-spin {
    to { transform: rotate(360deg); }
  }

  .vc-controls {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .vc-next-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 34px;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 15.5px;
    font-weight: 600;
    color: #07080d;
    background: linear-gradient(135deg, #8b7bff, #1fd1c1);
    box-shadow: 0 18px 40px rgba(139, 123, 255, 0.35);
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }

  .vc-next-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 22px 48px rgba(139, 123, 255, 0.45);
  }

  .vc-next-btn:active {
    transform: translateY(0) scale(0.97);
  }

  @media (max-width: 720px) {
    .vc-grid { grid-template-columns: 1fr; }
    .vc-tile { aspect-ratio: 4 / 3; }
  }
`;

export default App;
