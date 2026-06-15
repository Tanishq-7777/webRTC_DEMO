import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function App() {
  const [roomId, setRoomId] = useState("");
  const [status, setStatus] = useState("idle");

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  async function getLocalStream() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    localStreamRef.current = stream;

    localVideoRef.current.srcObject = stream;
  }

  function createPeerConnection() {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
      setStatus("in-call");
    };

    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pcRef.current = pc;
    return pc;
  }

  async function joinRoom() {
    if (!roomId.trim()) return;

    await getLocalStream();

    const socket = io("http://localhost:9999");
    socketRef.current = socket;

    socket.emit("join", roomId);

    socket.on("created", () => {
      setStatus("waiting");
    });

    socket.on("peer-joined", async () => {
      const pc = createPeerConnection();

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { roomId, sdp: offer });
    });

    socket.on("offer", async ({ sdp }) => {
      const pc = createPeerConnection();

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { roomId, sdp: answer });
    });

    socket.on("answer", async ({ sdp }) => {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        // Occasionally a candidate arrives before setRemoteDescription completes.
        // Safe to ignore -- ICE is resilient, other candidates will work.
        console.warn("addIceCandidate error (usually safe to ignore):", err);
      }
    });

    socket.on("peer-left", () => {
      setStatus("disconnected");
      pcRef.current?.close();
    });

    socket.on("room-full", () => {
      alert("Room is full (max 2 people).");
      socket.disconnect();
    });
  }

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h2>WebRTC Video Call</h2>

      {status === "idle" && (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Enter room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{ padding: "8px 12px", fontSize: 16 }}
          />
          <button
            onClick={joinRoom}
            style={{ padding: "8px 16px", fontSize: 16 }}
          >
            Join Room
          </button>
        </div>
      )}

      {status === "waiting" && (
        <p>⏳ Waiting for the other person to join...</p>
      )}
      {status === "in-call" && <p style={{ color: "green" }}>🟢 Connected</p>}
      {status === "disconnected" && (
        <p style={{ color: "red" }}>🔴 Peer disconnected</p>
      )}

      <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 12, color: "#666" }}>You</p>
          <video
            ref={localVideoRef}
            autoPlay
            muted // always mute local video -- avoids echo
            playsInline // needed on iOS to prevent fullscreen takeover
            style={{ width: 320, background: "#111", borderRadius: 8 }}
          />
        </div>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 12, color: "#666" }}>
            Remote
          </p>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: 320, background: "#111", borderRadius: 8 }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
