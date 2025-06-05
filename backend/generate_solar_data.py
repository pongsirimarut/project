import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.ensemble import IsolationForest
import pickle

# สร้างข้อมูลจำลอง
np.random.seed(42)
n_samples = 1000

data = {
    "solar_intensity": np.random.uniform(0, 1000, n_samples),
    "temperature": np.random.uniform(20, 40, n_samples),
    "cloud_cover": np.random.uniform(0, 100, n_samples),
    "humidity": np.random.uniform(30, 90, n_samples),
    "wind_speed": np.random.uniform(0, 15, n_samples),
}

df = pd.DataFrame(data)

# คำนวณ energy_output (สมการจำลอง)
df["energy_output"] = (
    df["solar_intensity"] * 0.005 *
    (1 - df["cloud_cover"] / 100) *
    (1 - df["humidity"] / 200) *
    (1 - df["wind_speed"] / 30)
)

# ฝึกโมเดลพยากรณ์
X = df[["solar_intensity", "temperature", "cloud_cover", "humidity", "wind_speed"]]
y = df["energy_output"]
solar_model = RandomForestRegressor(n_estimators=100, random_state=42)
solar_model.fit(X, y)

# ฝึกโมเดลตรวจจับ anomaly
anomaly_model = IsolationForest(contamination=0.1, random_state=42)
anomaly_model.fit(df[["energy_output"]])

# บันทึกโมเดล
with open("solar_forecast_model.pkl", "wb") as f:
    pickle.dump(solar_model, f)

with open("anomaly_model.pkl", "wb") as f:
    pickle.dump(anomaly_model, f)

print("Models generated and saved successfully!")