import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
import joblib

# ตรวจสอบและโหลดข้อมูล
try:
    data = pd.read_csv("weather_data.csv")
    if data.empty:
        raise ValueError("weather_data.csv is empty")
    required_columns = ["solar_intensity", "temperature", "cloud_cover", "humidity", "wind_speed", "energy_output"]
    if not all(col in data.columns for col in required_columns):
        raise ValueError(f"Missing columns. Expected: {required_columns}, Found: {data.columns.tolist()}")
    X = data[["solar_intensity", "temperature", "cloud_cover", "humidity", "wind_speed"]]
    y = data["energy_output"]
except FileNotFoundError:
    print("Error: weather_data.csv not found. Please create the file with required columns.")
    exit(1)
except pd.errors.ParserError as e:
    print(f"Error: Invalid CSV format - {str(e)}. Please check weather_data.csv and ensure consistent columns.")
    exit(1)
except ValueError as e:
    print(f"Error: {str(e)}. Please fix the CSV file.")
    exit(1)

# ปรับขนาดข้อมูล
scaler = MinMaxScaler()
X_scaled = scaler.fit_transform(X)
with open("scaler.pkl", "wb") as f:
    joblib.dump(scaler, f)

# แบ่งข้อมูลเป็น train/test set
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)

# ฝึกโมเดลสำหรับการพยากรณ์
forecast_model = RandomForestRegressor(n_estimators=100, random_state=42)
forecast_model.fit(X_train, y_train)
forecast_accuracy = forecast_model.score(X_test, y_test)
print(f"Forecast Model Accuracy (R²): {forecast_accuracy * 100:.2f}%")
joblib.dump(forecast_model, "solar_forecast_model.pkl")

# ฝึกโมเดลสำหรับการตรวจจับความผิดปกติ
anomaly_data = data[["energy_output", "solar_intensity"]]
anomaly_model = IsolationForest(contamination=0.1, random_state=42)
anomaly_model.fit(anomaly_data)
joblib.dump(anomaly_model, "anomaly_model.pkl")

print("Models trained and saved successfully!")