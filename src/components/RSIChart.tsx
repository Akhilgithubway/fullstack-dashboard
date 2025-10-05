import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ResponsiveContainer } from 'recharts';

interface RSIChartProps {
  data: { time: string; rsi: number }[];
}

const RSIChart: React.FC<RSIChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <ReferenceLine y={70} stroke="red" strokeDasharray="3 3" />
        <ReferenceLine y={30} stroke="green" strokeDasharray="3 3" />
        <Line type="monotone" dataKey="rsi" stroke="#82ca9d" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default RSIChart;
