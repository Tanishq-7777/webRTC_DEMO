import React, { useEffect, useRef } from "react";
import { io } from "socket.io-client";
const App = () => {
  const videoRef = useRef();
  const localStreamRef = useRef();
  const peerConnectionRef = useRef(null);
  const remoteVideoRef = useRef();

  // top of file, but with the header fix
  const socket = io("https://greedless-shine-caloric.ngrok-free.dev", {
    extraHeaders: {
      "ngrok-skip-browser-warning": "true",
    },
    transports: ["websocket"], // skip polling, go straight to WS
  });

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
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#111827",
        color: "white",
        padding: "20px",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          marginBottom: "30px",
          fontSize: "32px",
        }}
      >
        Video Call
      </h1>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            background: "#1f2937",
            padding: "15px",
            borderRadius: "15px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          <h3 style={{ textAlign: "center" }}>You</h3>
          <video
            ref={videoRef}
            autoPlay
            muted
            style={{
              width: "400px",
              maxWidth: "100%",
              borderRadius: "10px",
            }}
          />
        </div>

        <div
          style={{
            background: "#1f2937",
            padding: "15px",
            borderRadius: "15px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          <h3 style={{ textAlign: "center" }}>Remote User</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            style={{
              width: "400px",
              maxWidth: "100%",
              borderRadius: "10px",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
