import torch
import torch.nn as nn
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import os

class LSTMAutoencoder(nn.Module):
    def __init__(self, input_dim, hidden_dim):
        super(LSTMAutoencoder, self).__init__()
        self.encoder = nn.LSTM(input_dim, hidden_dim, batch_first=True)
        self.decoder = nn.LSTM(hidden_dim, input_dim, batch_first=True)

    def forward(self, x):
        _, (hidden, _) = self.encoder(x)
        seq_len = x.shape[1]
        context = hidden.permute(1, 0, 2).repeat(1, seq_len, 1) 
        output, _ = self.decoder(context)
        return output

def parse_hdfs_logs(file_path):
    print(f"--- Parsing HDFS logs from {file_path} ---")
    features_list = []
    if not os.path.exists(file_path):
        return []
    
    count = 0
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if "INFO" in line:
                errors = 0
                cpu = 1 if "latency" in line.lower() or "ms" in line.lower() else 0
                disk = 1 if "block" in line.lower() or "dest" in line.lower() else 0
                features_list.append([errors, cpu, disk])
                count += 1
            # Stop at 50,000 lines for sample training (HDFS is huge)
            if count > 50000:
                break
    
    print(f"Extracted {len(features_list)} normal samples from HDFS.")
    return features_list

def train_model():
    print("--- Starting LSTM Autoencoder Training ---")
    
    csv_path = '../datasets/sample_logs/training_data.csv'
    # Checking for both sample name and full HDFS name
    hdfs_options = ['../datasets/hdfs/HDFS_2k.log', '../datasets/hdfs/HDFS.log']
    
    all_features = []

    if os.path.exists(csv_path):
        df_csv = pd.read_csv(csv_path)
        normal_csv = df_csv[df_csv['label'] == 0].drop('label', axis=1).values
        all_features.extend(normal_csv.tolist())

    for path in hdfs_options:
        if os.path.exists(path):
            all_features.extend(parse_hdfs_logs(path))
            break

    if not all_features:
        print("Error: No data found. Please put HDFS.log in datasets/hdfs/")
        return

    all_features = np.array(all_features)
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(all_features)
    X_train = torch.tensor(scaled_data, dtype=torch.float32).unsqueeze(1)
    
    model = LSTMAutoencoder(X_train.shape[2], 16)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.005)
    
    for epoch in range(150):
        model.train()
        optimizer.zero_grad()
        output = model(X_train)
        loss = criterion(output, X_train)
        loss.backward()
        optimizer.step()
        if (epoch + 1) % 25 == 0:
            print(f'Epoch [{epoch+1}/150], Loss: {loss.item():.6f}')
            
    model.eval()
    with torch.no_grad():
        reconstructed = model(X_train)
        reconstruction_errors = torch.mean((reconstructed - X_train)**2, dim=(1, 2))
        threshold = torch.max(reconstruction_errors).item() * 1.3 
        
    os.makedirs('models', exist_ok=True)
    torch.save({'model_state': model.state_dict(), 'scaler': scaler, 'threshold': threshold, 'input_dim': X_train.shape[2], 'hidden_dim': 16}, 'models/lstm_model.pt')
    print(f"✅ Training Complete! Total samples: {len(all_features)}")

if __name__ == '__main__':
    train_model()
