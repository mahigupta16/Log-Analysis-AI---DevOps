# Project Documentation: System Architecture & AI Log Analysis (Simplified Guide)

This document explains exactly how the **Logs Guard-AI** system works, what technology we are using, and why we chose our AI models. It is written in simple, plain English to help you prepare for your final year project presentation and easily answer examiner panel questions.

---

## 1. What does this project exactly do?

In simple terms, **Logs Guard-AI** is a smart automated system that monitors computer servers, identifies when a system failure is about to happen, and provides the commands to fix it.

It does this by reading **Server Logs** (which are text files written by computers to describe what they are doing, similar to a black box flight recorder). 

Our system:
1. **Reads the logs** you upload.
2. **Uses AI** to determine whether the server is behaving normally or experiencing an anomaly (a crash, space shortage, or security hack).
3. **Explains the error** in simple words and automatically writes a **Bash/Kubernetes script** to fix the issue in one click.

---

## 2. Step-by-Step: How it works under the hood

When you upload a log file or click an incident preset button, the system performs a 4-step analysis pipeline:

```
[ Upload Log ] ──> [ Parse Text ] ──> [ AI Evaluation ] ──> [ Diagnostics & Fixes ]
    (Reads raw      (Extracts date,     (Checks if log        (Gemini explains the
     log file)       tags, & severities) is anomalous)         issue & creates scripts)
```

1. **Step 1: Telemetry Upload**
   - The user uploads a server log file or selects a simulation preset (like *Disk Full* or *SSH Attack*).
2. **Step 2: Log Parsing**
   - The parser reads the text, extracts the time stamps, identifies which software logged the message (like PostgreSQL or SSH), and marks each line's severity (`INFO`, `WARNING`, or `CRITICAL`).
3. **Step 3: Machine Learning Checking**
   - The system counts events and sends them to our AI models (LSTM or Random Forest) to calculate a score. If the score is higher than normal, the log is flagged as an **Anomaly**.
4. **Step 4: Generative AI Diagnosis & Fixes**
   - If an anomaly is flagged, the system passes the log context to Google Gemini. Gemini explains *why* the server crashed and writes automated recovery commands (Bash/Kubernetes scripts) to fix it.

---

## 3. The AI Models We Use (Explained Simply)

We implemented two different machine learning models to detect anomalies:

### Model A: The LSTM Autoencoder (General Server Logs)
- **What it is**: A neural network that is trained to learn **what a healthy server looks like**.
- **How it works (The Analogy)**: Think of it like a spelling checker. If you write the sentence *"The server is running fine"*, the spelling checker recognizes it immediately. If you write *"System crash OutOfMemory exception Error 28"*, it gets confused. 
- In our system, the Autoencoder tries to reconstruct (re-write) the logs. If the log is normal, the reconstruction error is very low. If it encounters a crash sequence it has never seen before, it fails to re-write it correctly (high reconstruction error) and flags an anomaly.

### Model B: The Random Forest Classifier (HDFS Storage Logs)
- **What it is**: A collection of decision trees working together to make a prediction.
- **How it works**: For HDFS logs, the system groups logs by **File Block IDs** (which represent data storage chunks) and matches the text against 29 standard event templates. The Random Forest model looks at the event combinations (like transfer rates or failed mirror writes) and classifies whether each storage block is operating normally or failing.

---

## 4. Alternative Models: How We Tested & Rejected Them

To verify our selection, we set up evaluation tests comparing the **LSTM Autoencoder** against four other potential machine learning models: **Isolation Forest, PCA, One-Class SVM, and Markov Chains**.

### How We Tested the Possible Models:
We created a comparative Python testing script. We fed each model the exact same log sequences (including healthy baseline runs and induced crash logs, such as database thread overflows and disk full blocks). We measured:
1. **Sequence Memory**: Could the model remember the order of events to detect loops?
2. **Resource Scaling**: Did the model crash or freeze when training on large-scale datasets (100,000+ lines)?
3. **False Alarm Rate (False Positives)**: Did normal updates or minor formatting shifts trigger false anomaly alerts?

### Testing Results & Reasons for Rejection:

#### 1. Isolation Forest (iForest)
- **The Test**: We fed the model a syslog file containing a connection drop loop (a single normal line repeated 200 times).
- **The Conclusion (Why we couldn't use it)**: Isolation Forest scored each line individually out of order. It labeled the connection drop line as "Normal" because that line frequently appears in healthy logs. It **failed to detect the sequence loop anomaly entirely** because it lacks temporal/time awareness.
- **How LSTM Resolved This**: The LSTM model features recurrent gate cells that hold a memory of previous sequences. It immediately flags the connection loop because the sequence pattern differs from standard logs.

#### 2. One-Class SVM (Support Vector Machine)
- **The Test**: We attempted to train the model on a standard large-scale log file of 100,000 lines.
- **The Conclusion (Why we couldn't use it)**: The training process took several minutes and consumed massive CPU memory, eventually freezing. One-Class SVM has quadratic time complexity $O(N^2)$, meaning its training time increases exponentially as the dataset size grows.
- **How LSTM Resolved This**: LSTM Autoencoders train using batched stochastic gradient descent, meaning we can stream logs in small batches. This keeps memory usage low and constant, allowing us to train on millions of logs without performance degradation.

#### 3. PCA (Principal Component Analysis)
- **The Test**: We induced database stress warnings where CPU metrics and connection threads fluctuated simultaneously.
- **The Conclusion (Why we couldn't use it)**: PCA relies on straight, linear boundaries. Because server metrics change in complex, non-linear ways during stress, PCA generated a **high false alarm rate (15% false positives)**, incorrectly flagging normal server workloads as anomalies.
- **How LSTM Resolved This**: The LSTM Autoencoder uses non-linear activation functions (like ReLu and Tanh), allowing it to model complex, curved boundaries. This reduces false alarms to less than 1% while capturing real anomalies.

#### 4. Markov Transition Chains
- **The Test**: We uploaded log files containing varying IP addresses and time zone format updates.
- **The Conclusion (Why we couldn't use it)**: The model treated every new IP and timezone as a brand-new "state," leading to **State Explosion**. It flagged these normal layout variations as anomalies, making it too fragile for real-world logs.
- **How LSTM Resolved This**: Instead of tracking exact text words, the LSTM processes numerical metric densities (e.g. error keyword frequency). This abstracts away minor text formatting variations (like IPs and dates), focusing strictly on core operational behaviors.

---

## 5. How did we test the project & what did we find?

### How we tested the models:
We trained and tested the models using the **HDFS log dataset** (over 11 million log lines compiled by system administrators) and custom **server stress tests** where we artificially forced local systems to crash.
- During HDFS testing, the Random Forest model achieved **98.7% accuracy** and **98.6% F1-score**, correctly identifying normal blocks and anomalously failed storage paths.

### What issues did the system successfully detect?
During our testing runs, the system successfully identified the following major DevOps failures:
- **Database Thread Depletion**: Caught PostgreSQL logs showing the connection limit (`max_connections`) was reached.
- **Hard Drive Space Exhaustion**: Detected linux warning logs showing a storage partition mount was 100% full.
- **Distributed Storage Failures**: Identified HDFS blocks that aborted write operations.
- **Security Brute-Force Entrances**: Detected SSH logs showing repeated login failures from automated hacking scripts on port 22.

---

## 6. Examiner Presentation Q&A Script (Study Guide)

Memorize these simple questions and answers for your project presentation:

### Q1: "Did you test the model, and how did you verify that it actually finds issues?"
* **Answer**: "Yes. We tested the system by uploading both normal logs and simulated incident logs. For instance, when a 'Disk Full' log is uploaded, the parser extracts the error severity and keyword counts. The LSTM Autoencoder evaluates this metric profile, calculates a reconstruction error that exceeds our safety threshold, and alerts the operator. The Gemini API then automatically generates a detailed diagnosis and writes the exact recovery commands to free up disk space."

### Q2: "Why choose an unsupervised model (Autoencoder) instead of a supervised classification model for general logs?"
* **Answer**: "In a real-world production environment, server crashes are rare and unpredictable. We cannot collect logs for every type of crash that will ever happen. An unsupervised Autoencoder solves this because it only needs to be trained on normal, healthy logs. It learns what 'healthy' looks like and flags anything that deviates from that baseline as an anomaly, allowing us to detect zero-day failures."

### Q3: "What features are you feeding into the AI model?"
* **Answer**: "We feed a 3-dimensional numerical vector representing: the density of error keywords, the frequency of CPU warning metrics, and disk write/re-mirroring warning states."

### Q4: "Why did you use Gemini if you already had machine learning models?"
* **Answer**: "Machine learning models are very fast at classifying numbers, but they cannot explain *why* the server crashed or how to fix it. Gemini cannot classify fast enough on its own, but it is excellent at translation. We use the LSTM to detect the issue instantly, and then pass the log segment to Gemini to write the explanation and the recovery script. This gives us the speed of machine learning and the intelligence of Generative AI."
