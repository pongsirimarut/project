from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.ensemble import RandomForestRegressor
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import requests
import logging
import firebase_admin
from firebase_admin import credentials, messaging
import numpy as np
from datetime import datetime, timedelta
import random

# ตั้งค่า logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ตั้งค่า Firebase Admin
try:
    cred = credentials.Certificate("firebase-service-account.json")
    firebase_admin.initialize_app(cred)
    logger.info("Firebase Admin initialized successfully")
except Exception as e:
    logger.error(f"Error initializing Firebase Admin: {str(e)}")

app = FastAPI()

# ตั้งค่า CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://project-ahvj2g40w-lemons-projects-935d928e.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# โหลดโมเดล
try:
    forecast_model = joblib.load("solar_forecast_model.pkl")
    anomaly_model = joblib.load("anomaly_model.pkl")
    logger.info("Models loaded successfully")
except FileNotFoundError as e:
    logger.error(f"Model files not found: {str(e)}. Please train the models using train_model.py.")
    raise Exception(f"Model files not found: {str(e)}. Please train the models using train_model.py.")
except Exception as e:
    logger.error(f"Error loading models: {str(e)}")
    raise Exception(f"Failed to load models: {str(e)}")

# SQLite setup
def init_db():
    conn = sqlite3.connect('weather_cache.db')
    cursor = conn.cursor()
    try:
        cursor.execute('PRAGMA table_info(weather)')
        columns = [row[1] for row in cursor.fetchall()]
        if 'date' not in columns:
            cursor.execute('ALTER TABLE weather ADD COLUMN date TEXT')
            logger.info("Added 'date' column to weather table")
        cursor.execute('''CREATE TABLE IF NOT EXISTS weather (
            city TEXT,
            timestamp INTEGER,
            solar_intensity REAL,
            temperature REAL,
            cloud_cover REAL,
            date TEXT
        )''')
        conn.commit()
    except sqlite3.Error as e:
        logger.error(f"Database error in init_db: {str(e)}")
    finally:
        conn.close()

init_db()

class WeatherData(BaseModel):
    solar_intensity: float
    temperature: float
    cloud_cover: float
    humidity: float | None = None
    wind_speed: float | None = None

class PanelData(BaseModel):
    energy_output: float
    solar_intensity: float

class NotificationData(BaseModel):
    token: str
    title: str
    body: str

def cache_weather_data(city: str, data: dict):
    conn = sqlite3.connect('weather_cache.db')
    cursor = conn.cursor()
    try:
        date_value = data.get('date', datetime.now().strftime('%Y-%m-%d'))
        timestamp_value = int(datetime.strptime(date_value, '%Y-%m-%d').timestamp())
        cursor.execute('''
            INSERT INTO weather (city, timestamp, solar_intensity, temperature, cloud_cover, date)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            city,
            timestamp_value,
            data['solar_intensity'],
            data['temperature'],
            data['cloud_cover'],
            date_value
        ))
        conn.commit()
        logger.info(f"Cached weather data for {city}: {data}")
    except sqlite3.Error as e:
        logger.error(f"Database error in cache_weather_data: {str(e)}")
    finally:
        conn.close()

def get_cached_weather(city: str):
    conn = sqlite3.connect('weather_cache.db')
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM weather WHERE timestamp < ?', (int(datetime.now().timestamp()) - 300,))
        conn.commit()
        cursor.execute('SELECT * FROM weather WHERE city = ? ORDER BY timestamp DESC LIMIT 7', (city,))
        rows = cursor.fetchall()
        if rows and len(rows) == 7:
            result = []
            for row in rows:
                result.append({
                    "timestamp": row[1],
                    "date": row[5] if row[5] else datetime.fromtimestamp(row[1]).strftime('%Y-%m-%d'),
                    "solar_intensity": row[2],
                    "temperature": row[3],
                    "cloud_cover": row[4]
                })
            logger.info(f"Returning cached weather data for {city}: {result}")
            return result
        return None
    except sqlite3.Error as e:
        logger.error(f"Database error in get_cached_weather: {str(e)}")
        return None
    finally:
        conn.close()

def estimate_solar_intensity(uv: float, cloud_cover: float, hour: int, month: int) -> float:
    base_intensity = 1500
    uv_factor = min(uv / 5, 1.0)
    seasonal_factor = 0.9 if 5 < month < 11 else 1.0
    cloud_factor = max(0.6, 1 - (min(cloud_cover, 80) / 100) * 0.4)
    hour_factor = max(0.6, np.cos(np.pi * (hour - 12) / 12) ** 2)
    solar_intensity = base_intensity * uv_factor * seasonal_factor * cloud_factor * hour_factor
    return max(500, round(solar_intensity))

@app.get("/weather")
async def get_weather(city: str = "Bangkok"):
    cached_data = get_cached_weather(city)
    if cached_data and len(cached_data) == 7:
        logger.info(f"Returning cached weather data for {city}")
        return cached_data

    api_key = "4a978622fbd7438685665053253005"
    url = f"http://api.weatherapi.com/v1/forecast.json?key={api_key}&q={city}&days=7&aqi=no&alerts=no"
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()
        logger.info(f"Raw API Response: {data}")
        if len(data["forecast"]["forecastday"]) < 7:
            logger.warning(f"API returned only {len(data['forecast']['forecastday'])} days, expected 7")
            current_date = datetime.now()
            while len(data["forecast"]["forecastday"]) < 7:
                last_day = data["forecast"]["forecastday"][-1]
                next_date = (datetime.strptime(last_day["date"], "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
                data["forecast"]["forecastday"].append({
                    "date": next_date,
                    "hour": last_day["hour"]
                })

        current_time = datetime.now()
        hour = current_time.hour
        month = current_time.month

        forecast_days = {}
        for forecast in data["forecast"]["forecastday"]:
            date_str = forecast["date"]
            forecast_days[date_str] = {
                "solar_intensities": [],
                "temperatures": [],
                "cloud_covers": [],
            }
            for hour_data in forecast["hour"]:
                dt = datetime.fromtimestamp(hour_data["time_epoch"])
                uv = hour_data.get("uv", 1.0)
                cloud = hour_data.get("cloud", 50)
                forecast_days[date_str]["solar_intensities"].append(
                    estimate_solar_intensity(uv, cloud, dt.hour, month)
                )
                forecast_days[date_str]["temperatures"].append(hour_data["temp_c"])
                forecast_days[date_str]["cloud_covers"].append(cloud)

        result = []
        for i, (date_str, values) in enumerate(sorted(forecast_days.items())):
            if i >= 7:
                break
            day_data = {
                "date": date_str,
                "solar_intensity": round(sum(values["solar_intensities"]) / len(values["solar_intensities"])),
                "temperature": round(sum(values["temperatures"]) / len(values["temperatures"]), 1),
                "cloud_cover": round(sum(values["cloud_covers"]) / len(values["cloud_covers"]))
            }
            result.append(day_data)
            cache_weather_data(city, day_data)
            logger.info(f"Weather Data for {date_str}: {day_data}")

        while len(result) < 7:
            last_day = result[-1]
            next_date = (datetime.strptime(last_day["date"], "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
            day_data = {
                "date": next_date,
                "solar_intensity": max(400, last_day["solar_intensity"]),
                "temperature": last_day["temperature"],
                "cloud_cover": min(80, last_day["cloud_cover"])
            }
            result.append(day_data)
            cache_weather_data(city, day_data)

        logger.info(f"Fetched forecast weather data for {city}: {result}")
        return result[:7]
    except requests.Timeout:
        logger.error(f"Timeout fetching weather data for {city}")
        current_date = datetime.now()
        fallback_data = [{
            "date": (current_date + timedelta(days=i)).strftime("%Y-%m-%d"),
            "solar_intensity": random.uniform(400, 1000),
            "temperature": random.uniform(25, 35),
            "cloud_cover": random.uniform(0, 80)
        } for i in range(7)]
        for data in fallback_data:
            cache_weather_data(city, data)
        logger.info(f"Returning fallback weather data for {city}")
        return fallback_data
    except requests.RequestException as e:
        logger.error(f"Unable to fetch weather data for {city}: {str(e)}")
        current_date = datetime.now()
        fallback_data = [{
            "date": (current_date + timedelta(days=i)).strftime("%Y-%m-%d"),
            "solar_intensity": random.uniform(400, 1000),
            "temperature": random.uniform(25, 35),
            "cloud_cover": random.uniform(0, 80)
        } for i in range(7)]
        for data in fallback_data:
            cache_weather_data(city, data)
        logger.info(f"Returning fallback weather data for {city}")
        return fallback_data

@app.post("/forecast")
async def forecast_energy(data: WeatherData):
    try:
        panel_area = 2
        efficiency = 0.2
        performance_ratio = 0.85
        sunlight_hours = 6
        cloud_factor = max(0.5, 1 - (min(data.cloud_cover, 80) / 100) * 0.5)
        base_energy = (max(500, data.solar_intensity) * panel_area * efficiency * performance_ratio * sunlight_hours * cloud_factor) / 1000
        energy_output = round(max(1.5, base_energy), 3)
        logger.info(f"Calculated energy_output: {energy_output}")
        return {"energy_output": energy_output}
    except Exception as e:
        logger.error(f"Unexpected error in /forecast: {str(e)}")
        return {"energy_output": 1.5}

@app.get("/forecast-get")
async def forecast_energy_get(solar_intensity: float, temperature: float, cloud_cover: float, humidity: float = 60.0, wind_speed: float = 1.39):
    try:
        data = WeatherData(
            solar_intensity=solar_intensity,
            temperature=temperature,
            cloud_cover=cloud_cover,
            humidity=humidity,
            wind_speed=wind_speed
        )
        panel_area = 2
        efficiency = 0.2
        performance_ratio = 0.85
        sunlight_hours = 6
        cloud_factor = max(0.5, 1 - (min(data.cloud_cover, 80) / 100) * 0.5)
        base_energy = (max(500, data.solar_intensity) * panel_area * efficiency * performance_ratio * sunlight_hours * cloud_factor) / 1000
        energy_output = round(max(1.5, base_energy), 3)
        logger.info(f"Calculated energy_output: {energy_output}")
        return {"energy_output": energy_output}
    except Exception as e:
        logger.error(f"Unexpected error in /forecast-get: {str(e)}")
        return {"energy_output": 1.5}

@app.post("/detect-anomaly")
async def detect_anomaly(data: PanelData):
    logger.info(f"Received data for /detect-anomaly: {data.dict()}")
    try:
        if not isinstance(data.energy_output, (int, float)) or not isinstance(data.solar_intensity, (int, float)):
            logger.error(f"Invalid input data: energy_output={data.energy_output}, solar_intensity={data.solar_intensity}")
            raise HTTPException(status_code=400, detail="energy_output and solar_intensity must be numbers")

        local_anomaly_model = anomaly_model
        if not hasattr(local_anomaly_model, 'predict'):
            logger.error("anomaly_model is not properly initialized or lacks predict")
            np.random.seed(42)
            anomaly_sample_data = pd.DataFrame({
                "energy_output": np.random.normal(2.0, 0.5, 1000),
                "solar_intensity": np.random.normal(800, 1000, 200),
            })
            local_anomaly_model = IsolationForest(contamination=0.1, random_state=42)
            local_anomaly_model.fit(anomaly_sample_data)
            joblib.dump(local_anomaly_model, "anomaly_model.pkl")
            logger.info("Re-trained and saved anomaly_model")

        input_data = pd.DataFrame(
            [[data.energy_output, data.solar_intensity]],
            columns=["energy_output", "solar_intensity"]
        )
        logger.info(f"Input data for anomaly detection: {input_data.to_dict()}")

        try:
            prediction = local_anomaly_model.predict(input_data)[0]
        except Exception as e:
            logger.error(f"Error in anomaly_model.predict: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error in anomaly detection model: {str(e)}")

        is_anomaly = prediction == -1
        if is_anomaly:
            logger.info("Anomaly detected in panel data")
            return {"anomaly": True, "message": "Anomaly detected in panel data"}
        logger.info("No anomaly detected")
        return {"anomaly": False, "message": "No anomaly detected"}
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error in /detect-anomaly: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error in anomaly detection: {str(e)}")

@app.get("/detect-anomaly-get")
async Нижнее белье
async def detect_anomaly_get(energy_output: float, solar_intensity: float):
    data = PanelData(
        energy_output=energy_output,
        solar_intensity=solar_intensity
    )
    logger.info(f"Received data for /detect-anomaly-get: {data.dict()}")
    try:
        if not isinstance(data.energy_output, (int, float)) or not isinstance(data.solar_intensity, (int, float)):
            logger.error(f"Invalid input data: energy_output={data.energy_output}, solar_intensity={data.solar_intensity}")
            raise HTTPException(status_code=400, detail="energy_output and solar_intensity must be numbers")

        local_anomaly_model = anomaly_model
        if not hasattr(local_anomaly_model, 'predict'):
            logger.error("anomaly_model is not properly initialized or lacks predict method")
            np.random.seed(42)
            anomaly_sample_data = pd.DataFrame({
                "energy_output": np.random.normal(2.0, 0.5, 1000),
                "solar_intensity": np.random.normal(800, 200, 1000),
            })
            local_anomaly_model = IsolationForest(contamination=0.1, random_state=42)
            local_anomaly_model.fit(anomaly_sample_data)
            joblib.dump(local_anomaly_model, "anomaly_model.pkl")
            logger.info("Re-trained and saved anomaly_model")

        input_data = pd.DataFrame(
            [[data.energy_output, data.solar_intensity]],
            columns=["energy_output", "solar_intensity"]
        )
        logger.info(f"Input data for anomaly detection: {input_data.to_dict()}")

        try:
            prediction = local_anomaly_model.predict(input_data)[0]
        except Exception as e:
            logger.error(f"Error in anomaly_model.predict: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error in anomaly detection model: {str(e)}")

        is_anomaly = prediction == -1
        if is_anomaly:
            logger.info("Anomaly detected in panel data")
            return {"anomaly": True, "message": "Anomaly detected in panel data"}
        logger.info("No anomaly detected")
        return {"anomaly": False, "message": "No anomaly detected"}
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error in /detect-anomaly-get: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error in anomaly detection: {str(e)}")

@app.get("/panel-recommendation")
async def panel_recommendation(energy_demand: float, solar_intensity: float = 800):
    try:
        panel_area = 2
        efficiency = 0.2
        performance_ratio = 0.85
        sunlight_hours = 6
        cloud_cover = 50
        cloud_factor = max(0.2, 1 - (cloud_cover / 100) * 0.8)
        energy_per_panel = (solar_intensity * panel_area * efficiency * performance_ratio * sunlight_hours * cloud_factor) / 1000
        if energy_per_panel <= 0:
            raise ValueError("Energy per panel is zero or negative")
        num_panels = max(1, round(energy_demand / energy_per_panel))
        cost_per_panel = 10000
        electricity_price = 4
        total_cost = num_panels * cost_per_panel
        daily_revenue = energy_per_panel * num_panels * electricity_price
        payback_period_days = total_cost / daily_revenue if daily_revenue > 0 else float('inf')
        payback_period_years = payback_period_days / 365

        logger.info(f"Panel recommendation: {num_panels} panels for demand {energy_demand} kWh, Payback: {payback_period_years:.1f} years")
        return {
            "num_panels": num_panels,
            "payback_period_years": round(payback_period_years, 1)
        }
    except Exception as e:
        logger.error(f"Error in /panel-recommendation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calculating panel recommendation: {str(e)}")

@app.post("/send-notification")
async def send_notification(data: NotificationData):
    message = messaging.Message(
        notification=messaging.Notification(
            title=data.title,
            body=data.body,
        ),
        token=data.token,
    )
    try:
        response = messaging.send(message)
        logger.info(f"Notification sent: {response}")
        return {"status": "Notification sent"}
    except Exception as e:
        logger.error(f"Error sending notification: {str(e)}")
        return {"error": f"Error sending notification: {str(e)}"}