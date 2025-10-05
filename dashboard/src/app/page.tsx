"use client";

import { useEffect, useState, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface RsiMessage {
  token: string;
  time: string;
  price: number;
  rsi: number;
}

export default function Dashboard() {
  const [selectedToken, setSelectedToken] = useState("BTC");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [currentRsi, setCurrentRsi] = useState<number | null>(null);
  const [priceData, setPriceData] = useState<RsiMessage[]>([]);
  const [rsiData, setRsiData] = useState<RsiMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8080"); // Replace with your Rust WS server URL
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data: RsiMessage = JSON.parse(event.data);

        if (data.token === selectedToken) {
          setCurrentPrice(data.price);
          setCurrentRsi(data.rsi);

          setPriceData((prev) => [...prev, data].slice(-20)); // Keep last 20 points
          setRsiData((prev) => [...prev, data].slice(-20));
        }
      } catch (err) {
        console.error("Error parsing message", err);
      }
    };

    ws.onerror = (err) => console.error("WebSocket error", err);

    return () => {
      ws.close();
    };
  }, [selectedToken]);

  return (
    <div style={{ textAlign: "center", margin: "20px" }}>
      <h1>Fullstack Dashboard</h1>

      <div style={{ margin: "20px" }}>
        <label>Select Token: </label>
        <select
          value={selectedToken}
          onChange={(e) => setSelectedToken(e.target.value)}
        >
          <option value="BTC">BTC</option>
          <option value="SOL">SOL</option>
          <option value="ETH">ETH</option>
          <option value="ADA">ADA</option>
          <option value="DOT">DOT</option>
        </select>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <p>Current Price: {currentPrice ?? "--"}</p>
        <p>Current RSI: {currentRsi ?? "--"}</p>
      </div>

      <div style={{ marginBottom: "40px" }}>
        <h3>Price Chart</h3>
        <ResponsiveContainer width="95%" height={300}>
          <LineChart data={priceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#8884d8"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3>RSI Chart</h3>
        <ResponsiveContainer width="95%" height={300}>
          <LineChart data={rsiData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="rsi"
              stroke="#82ca9d"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
