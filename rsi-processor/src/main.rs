use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::message::Message;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::protocol::Message as WsMessage;

#[derive(Debug, Deserialize)]
struct Trade {
    token_address: String,
    price_in_sol: f64,
    block_time: String,
}

#[derive(Debug, Serialize, Clone)]
struct RsiData {
    token: String,
    time: String,
    price: f64,
    rsi: f64,
}

fn calculate_rsi(prices: &[f64]) -> f64 {
    if prices.len() < 15 {
        return 0.0;
    }

    let mut gains = 0.0;
    let mut losses = 0.0;

    for i in 1..=14 {
        let diff = prices[i] - prices[i - 1];
        if diff > 0.0 {
            gains += diff;
        } else {
            losses += -diff;
        }
    }

    let avg_gain = gains / 14.0;
    let avg_loss = losses / 14.0;

    if avg_loss == 0.0 {
        return 100.0;
    }

    let rs = avg_gain / avg_loss;
    100.0 - (100.0 / (1.0 + rs))
}

#[tokio::main]
async fn main() -> Result<()> {
    // Kafka consumer
    let consumer: StreamConsumer = ClientConfig::new()
        .set("group.id", "rsi_processor_group")
        .set("bootstrap.servers", "localhost:9092")
        .create()?;

    consumer.subscribe(&["trade-data"])?;

    // WebSocket clients
    let clients: Arc<Mutex<Vec<tokio_tungstenite::tungstenite::protocol::WebSocket<tokio::net::TcpStream>>>> =
        Arc::new(Mutex::new(Vec::new()));

    // Store price history per token
    let price_history: Arc<Mutex<HashMap<String, Vec<f64>>>> = Arc::new(Mutex::new(HashMap::new()));

    // WebSocket server
    let ws_clients = clients.clone();
    tokio::spawn(async move {
        let listener = TcpListener::bind("127.0.0.1:8080").await.unwrap();
        println!("WebSocket server running on ws://127.0.0.1:8080");

        while let Ok((stream, _)) = listener.accept().await {
            let ws_clients = ws_clients.clone();
            tokio::spawn(async move {
                let ws_stream = accept_async(stream).await.unwrap();
                ws_clients.lock().unwrap().push(ws_stream);
            });
        }
    });

    // Consume Kafka messages and broadcast RSI
    let price_hist = price_history.clone();
    let ws_clients = clients.clone();
    let mut message_stream = consumer.stream();

    while let Some(message) = message_stream.next().await {
        if let Ok(msg) = message {
            if let Some(payload) = msg.payload() {
                if let Ok(trade) = serde_json::from_slice::<Trade>(payload) {
                    let mut hist = price_hist.lock().unwrap();
                    let entry = hist.entry(trade.token_address.clone()).or_insert_with(Vec::new);
                    entry.push(trade.price_in_sol);
                    if entry.len() > 15 {
                        entry.remove(0);
                    }
                    let rsi = calculate_rsi(entry);

                    let rsi_data = RsiData {
                        token: trade.token_address.clone(),
                        time: trade.block_time.clone(),
                        price: trade.price_in_sol,
                        rsi,
                    };

                    let json = serde_json::to_string(&rsi_data).unwrap();

                    // Broadcast to all WebSocket clients
                    let mut to_remove = Vec::new();
                    let mut clients_lock = ws_clients.lock().unwrap();
                    for (i, ws) in clients_lock.iter_mut().enumerate() {
                        if ws.send(WsMessage::Text(json.clone())).await.is_err() {
                            to_remove.push(i);
                        }
                    }
                    // Remove disconnected clients
                    for i in to_remove.into_iter().rev() {
                        clients_lock.remove(i);
                    }

                    println!("Broadcasted: {:?}", rsi_data);
                }
            }
        }
    }

    Ok(())
}
