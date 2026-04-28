import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import pickle
import os

# ── Configuration ──────────────────────────────────────────
# Paths to the HDFS dataset CSV files
FEATURES_PATH = '../datasets/hdfs/Event_occurrence_matrix.csv'
LABELS_PATH = '../datasets/hdfs/anomaly_label.csv'
MODEL_SAVE_PATH = 'models/hdfs_rf_model.pkl'

def train_hdfs_model():
    # Create models directory if it doesn't exist
    os.makedirs('models', exist_ok=True)

    # ── Load Data ──────────────────────────────────────────────
    print("🚀 Loading HDFS dataset...")
    
    if not os.path.exists(FEATURES_PATH) or not os.path.exists(LABELS_PATH):
        print(f"❌ Error: Dataset files not found at {FEATURES_PATH} or {LABELS_PATH}")
        print("Please ensure you have added Event_occurrence_matrix.csv and anomaly_label.csv to datasets/hdfs/")
        return

    # Load features
    print("读取特征矩阵 (Reading features)...")
    X_df = pd.read_csv(FEATURES_PATH)
    
    # Load labels
    print("读取标签 (Reading labels)...")
    y_df = pd.read_csv(LABELS_PATH)

    # ── Align Data ──────────────────────────────────────────────
    print("🔄 Aligning features and labels by BlockId...")
    # The occurrence matrix has BlockId. anomaly_label.csv also has BlockId.
    # We merge them to ensure every feature row has a corresponding label.
    data = pd.merge(X_df, y_df, on='BlockId')

    # Identify feature columns (usually E1, E2, ... E29)
    # We skip BlockId, Label (from X), Type, and Label (from y)
    feature_cols = [col for col in X_df.columns if col.startswith('E')]
    
    X = data[feature_cols]
    y = data['Label_y'] # Use the label from anomaly_label.csv (merged as Label_y)

    print(f"✅ Data alignment complete.")
    print(f"Total samples: {len(X)}")
    print(f"Anomaly counts:\n{y.value_counts()}")

    # ── Split into Train and Test ───────────────────────────────
    # 80% training, 20% testing
    print("\n📦 Splitting data into Train (80%) and Test (20%)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, 
        test_size=0.2, 
        random_state=42,
        stratify=y # Maintain anomaly ratio in both sets
    )

    print(f"Training samples: {len(X_train)}")
    print(f"Testing samples:  {len(X_test)}")

    # ── Train the Model ─────────────────────────────────────────
    print("\n🏗️ Training Random Forest model (this might take a moment)...")
    # Using n_jobs=-1 to use all CPU cores for faster training
    model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)
    print("⭐ Training complete!")

    # ── Test the Model ──────────────────────────────────────────
    print("\n🧪 Evaluating model on Test Dataset (unseen data)...")
    y_pred = model.predict(X_test)

    # Calculate metrics
    accuracy = accuracy_score(y_test, y_pred)
    train_accuracy = model.score(X_train, y_train)

    print(f"\n📈 Results:")
    print(f"✅ Training Accuracy: {train_accuracy * 100:.2f}%")
    print(f"✅ Testing Accuracy:  {accuracy * 100:.2f}%")

    print("\n── Detailed Classification Report ──")
    print(classification_report(y_test, y_pred))

    print("── Confusion Matrix ──")
    cm = confusion_matrix(y_test, y_pred)
    print(f"True Normal  (correct): {cm[0][0]}")
    print(f"False Anomaly (wrong):  {cm[0][1]}")
    print(f"False Normal  (wrong):  {cm[1][0]}")
    print(f"True Anomaly (correct): {cm[1][1]}")

    # ── Save the Model ──────────────────────────────────────────
    print(f"\n💾 Saving model to {MODEL_SAVE_PATH}...")
    with open(MODEL_SAVE_PATH, 'wb') as f:
        pickle.dump({
            'model': model,
            'feature_cols': feature_cols
        }, f)
    print("✅ Model saved successfully!")
    print("\nYou can now use this model for predictions!")

if __name__ == '__main__':
    train_hdfs_model()
