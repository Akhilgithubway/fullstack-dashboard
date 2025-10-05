import { Kafka } from 'kafkajs';
import fs from 'fs';
import csv from 'csv-parser';

const kafka = new Kafka({
  brokers: ['localhost:9092']
});

const producer = kafka.producer();

async function sendData() {
  await producer.connect();
  console.log("✅ Connected to Redpanda...");

  fs.createReadStream('../trades_data.csv')
    .pipe(csv())
    .on('data', async (row) => {
      const message = {
        token_address: row.token_address,
        price_in_sol: parseFloat(row.price_in_sol),
        block_time: row.block_time
      };

      await producer.send({
        topic: 'trade-data',
        messages: [{ value: JSON.stringify(message) }]
      });

      console.log("📤 Sent:", message);
    })
    .on('end', async () => {
      console.log("✅ All rows sent!");
      await producer.disconnect();
    });
}

sendData().catch(console.error);
