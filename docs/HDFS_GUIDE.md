# Plugging in the HDFS Log Dataset (LogHub)

To make your AI Log Intelligence model more robust, you can use the **HDFS (Hadoop Distributed File System)** dataset from LogHub. This dataset contains millions of log entries that include real system anomalies.

### 1. Download Link
You can download the dataset directly from the LogHub repository:
- **Download:** [HDFS_2k.log (Sample)](https://github.com/logpai/loghub/blob/master/HDFS/HDFS_2k.log)
- **Full Dataset:** [HDFS Full Dataset](https://zenodo.org/record/3227177)

### 2. How to Add it to the Model

To integrate this data, follow these steps:

#### Step A: Data Parsing
The HDFS log format looks like this:
`081109 203518 143 INFO dfs.DataNode$DataXceiver: Receiving block blk_-1608999687919862906 src: /10.250.19.102:54107 dest: /10.250.19.102:50010`

You need to extract features similar to our `training_data.csv` (Errors, CPU mentions, etc.).

#### Step B: Updating `ml_model.py`
Add a new function to parse the HDFS file and append it to your training dataframe:

```python
def parse_hdfs_logs(file_path):
    features_list = []
    with open(file_path, 'r') as f:
        for line in f:
            # Simple feature extraction
            errors = 1 if "ERROR" in line or "Exception" in line else 0
            cpu = 1 if "latency" in line or "timeout" in line else 0
            disk = 1 if "full" in line or "capacity" in line else 0
            # HDFS logs are normal unless labeled otherwise, 
            # but for training the Autoencoder, we only take 'Normal' ones.
            features_list.append([errors, cpu, disk])
    return features_list

# In your train_model() function:
hdfs_features = parse_hdfs_logs('path/to/HDFS.log')
hdfs_df = pd.DataFrame(hdfs_features, columns=['errors', 'cpu', 'disk'])
df = pd.concat([df, hdfs_df], ignore_index=True)
```

#### Step C: Re-train
After merging the data, simply run `python ml_model.py` again. The LSTM Autoencoder will now have a much broader understanding of what "normal" large-scale system logs look like, improving its detection accuracy on real-world data.

### 3. Why it helps
- **Diversity:** Real logs have more noise. Training on HDFS data teaches the model to ignore common system messages.
- **Scale:** Larger datasets help LSTM models converge better and find more subtle patterns.
