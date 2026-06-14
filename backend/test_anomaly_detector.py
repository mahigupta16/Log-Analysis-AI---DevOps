import os
import sys
import json

# Ensure python can import from the current directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from anomaly_detector import detect_anomaly

def test_logs():
    print("==================================================")
    print("Testing Anomaly Detector with Dynamic Parser")
    print("==================================================")
    
    samples = [
        "../datasets/sample_logs/normal_log.txt",
        "../datasets/sample_logs/anomaly_log_1.txt",
        "../datasets/sample_logs/anomaly_log_2.txt"
    ]
    
    for sample in samples:
        path = os.path.join(os.path.dirname(__file__), sample)
        if not os.path.exists(path):
            print(f"Skipping: {sample} (File not found)")
            continue
            
        print(f"\nEvaluating: {sample}")
        print("-" * 40)
        try:
            # We call detect_anomaly. Note: if LSTM model is not trained, this might report error.
            # Let's see if we get the parsed results.
            result = detect_anomaly(path)
            
            # Print reconstruction error details
            print(f"Reconstruction Error: {result.get('reconstruction_error')}")
            print(f"Reconstruction Error Threshold: {result.get('threshold')}")
            
            # Print parsed details cleanly
            print(f"Status: {result.get('status')}")
            print(f"Confidence: {result.get('confidence')}%")
            print(f"Detected Issue: {result.get('detected_issue')}")
            print(f"Failed Node: {result.get('failed_node')}")
            print(f"Why it failed: {result.get('why_it_failed')}")
            print("Flow Graph Topology:")
            for node in result.get('flow', []):
                print(f"  - {node['node']} -> status: {node['status']}, desc: {node.get('desc')}")
            print(f"Features: {result.get('features')}")
            print(f"Filename: {result.get('filename')}")
        except Exception as e:
            print(f"Error testing sample: {e}")

if __name__ == "__main__":
    test_logs()
