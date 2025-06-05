import csv
import requests

api_key = "4a978622fbd7438685665053253005"
url = f"http://api.weatherapi.com/v1/forecast.json?key={api_key}&q=Bangkok&days=7&aqi=no&alerts=no"
try:
    response = requests.get(url, timeout=15)
    response.raise_for_status()
    data = response.json()
    print("API Response Sample:", data["forecast"]["forecastday"][0]["hour"][0])  # Debug ข้อมูลจาก API
except requests.RequestException as e:
    print(f"Error fetching data: {str(e)}")
    exit(1)

# สร้างไฟล์ CSV
with open("weather_data.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["solar_intensity", "temperature", "cloud_cover", "humidity", "wind_speed", "energy_output"])
    for i, day in enumerate(data["forecast"]["forecastday"], 1):
        hour_data = day["hour"][0]
        temperature = float(hour_data.get("temp_c", 30.0))
        cloud_cover = float(hour_data.get("cloud", 50))
        humidity = float(hour_data.get("humidity", 60))
        wind_kph = float(hour_data.get("wind_kph", 5))
        wind_speed = wind_kph / 3.6
        row = [
            500.0,
            temperature,
            cloud_cover,
            humidity,
            wind_speed,
            2.0
        ]
        print(f"Row {i+1}: {row}")  # Debug แต่ละแถว
        writer.writerow(row)

print("weather_data.csv created successfully!")