import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import WeatherCard from '../components/WeatherCard';
import EnergyChart from '../components/EnergyChart';
import AlertCard from '../components/AlertCard';
import { requestNotificationPermission, onMessageListener } from '../lib/firebase';
import styles from '../styles/index.module.css';

interface WeatherData {
  solar_intensity: number;
  temperature: number;
  cloud_cover: number;
  date: string;
}

interface ForecastData {
  energy_output: number;
}

interface AnomalyData {
  anomaly: boolean;
  message: string;
}

const Dashboard = () => {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [anomaly, setAnomaly] = useState<AnomalyData | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [energyTomorrow, setEnergyTomorrow] = useState<number>(0);
  const [actualEnergy, setActualEnergy] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasCloudAlert = useRef(false);
  const hasDirtyPanelAlert = useRef(false);
  const hasConnectionAlert = useRef(false);

  // ใช้ Environment Variable สำหรับ API URL
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

  const sendNotification = (message: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('แจ้งเตือนพลังงานแสงอาทิตย์', { body: message });
    }
    if (typeof window !== 'undefined') {
      requestNotificationPermission().then(token => {
        if (token) {
          axios.post(`${API_URL}/send-notification`, {
            token,
            title: 'แจ้งเตือนพลังงานแสงอาทิตย์',
            body: message,
          }).catch(error => console.error('Error sending FCM:', error));
        }
      });
    }
  };

  const round = (value: number, decimals: number) => {
    return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
  };

  const retry = async (fn: () => Promise<any>, retries: number = 3, delay: number = 2000) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        if (i === retries - 1) {
          console.error(`Failed after ${retries} retries: ${error.message}`);
          setError(`ไม่สามารถดึงข้อมูลได้: ${error.message}`);
          sendNotification(`ไม่สามารถดึงข้อมูลได้: ${error.message}`);
          throw error;
        }
        console.warn(`Retrying (${i + 1}/${retries}) after error: ${error.message}`);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const weatherResponse = await retry(() => axios.get(`${API_URL}/weather?city=Bangkok`, {
          timeout: 20000,
          headers: { 'Content-Type': 'application/json' }
        }));
        if (Array.isArray(weatherResponse.data) && weatherResponse.data.length > 0) {
          setWeatherData(weatherResponse.data);

          const weatherToday = weatherResponse.data[0];
          const forecastResponse = await retry(() => axios.post(`${API_URL}/forecast`, {
            solar_intensity: weatherToday.solar_intensity,
            temperature: weatherToday.temperature,
            cloud_cover: weatherToday.cloud_cover,
            humidity: 60,
            wind_speed: 1.39,
          }, {
            timeout: 20000,
            headers: { 'Content-Type': 'application/json' }
          }));
          setActualEnergy(forecastResponse.data.energy_output);

          const anomalyResponse = await retry(() => axios.post(`${API_URL}/detect-anomaly`, {
            energy_output: forecastResponse.data.energy_output,
            solar_intensity: weatherToday.solar_intensity,
          }, {
            timeout: 20000,
            headers: { 'Content-Type': 'application/json' }
          }));
          setAnomaly(anomalyResponse.data);
        } else {
          console.error('ข้อมูลสภาพอากาศไม่ถูกต้อง:', weatherResponse.data);
          setWeatherData([{
            solar_intensity: 500,
            temperature: 30.0,
            cloud_cover: 50,
            date: new Date().toISOString().split('T')[0],
          }]);
          setActualEnergy(1.5);
          setAnomaly({ anomaly: false, message: 'ปกติ' });
        }
      } catch (error: any) {
        console.error('Error fetching data:', error.response?.data || error.message);
        setWeatherData([{
          solar_intensity: 500,
          temperature: 30.0,
          cloud_cover: 50,
          date: new Date().toISOString().split('T')[0],
        }]);
        setActualEnergy(1.5);
        setAnomaly({ anomaly: false, message: 'ปกติ' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);

    if (typeof window !== 'undefined') {
      requestNotificationPermission().then(token => {
        if (token) console.log('FCM Token:', token);
      });
      onMessageListener().then(payload => {
        if (payload?.notification) {
          setAlerts(prev => [...prev, `${payload.notification.title || 'แจ้งเตือน'}: ${payload.notification.body || ''}`]);
        }
      }).catch(error => console.error('Error in FCM listener:', error));
    }

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!weatherData.length) return;

    const weatherToday = weatherData[0];
    const threshold = Number(localStorage.getItem('cloudCoverThreshold') || 50);
    if (weatherToday.cloud_cover > threshold && !hasCloudAlert.current) {
      const alertMessage = `ปริมาณเมฆสูงเกิน ${threshold}% อาจกระทบการผลิตพลังงาน`;
      setAlerts(prev => [...prev, alertMessage]);
      hasCloudAlert.current = true;
      sendNotification(alertMessage);
    } else if (weatherToday.cloud_cover <= threshold && hasCloudAlert.current) {
      hasCloudAlert.current = false;
    }

    if (anomaly && anomaly.anomaly) {
      if (!hasDirtyPanelAlert.current) {
        setAlerts(prev => [...prev, anomaly.message]);
        hasDirtyPanelAlert.current = true;
        sendNotification(anomaly.message);
      }
    } else if (anomaly && !anomaly.anomaly) {
      hasDirtyPanelAlert.current = false;
      hasConnectionAlert.current = false;
    }
  }, [weatherData, anomaly]);

  if (loading) return <div className={styles.loading}>กำลังโหลดข้อมูล...</div>;
  if (error) return <div className={styles.error}>ข้อผิดพลาด: {error}</div>;

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.section}>
        <h1 className={styles.sectionTitle}>ภาพรวมระบบ</h1>
        <p className={styles.sectionSubtitle}>ติดตามประสิทธิภาพและสุขภาพของระบบแผงโซล่าเซลล์ของคุณแบบเรียลไทม์</p>
      </div>
      {weatherData.length > 0 && (
        <div className={styles.overviewGrid}>
          <div className={styles.overviewCard}>
            <p className={styles.cardTitle}>ความเข้มแสงอาทิติตย์</p>
            <p className={styles.cardValue}>{weatherData[0].solar_intensity} W/m²</p>
          </div>
          <div className={styles.overviewCard}>
            <p className={styles.cardTitle}>อุณหภูมิ</p>
            <p className={styles.cardValue}>{weatherData[0].temperature?.toFixed(1) || 'N/A'}°C</p>
          </div>
          <div className={styles.overviewCard}>
            <p className={styles.cardTitle}>ความชื้น</p>
            <p className={styles.cardValue}>{weatherData[0].cloud_cover}%</p>
          </div>
        </div>
      )}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>การพยากรณ์พลังงาน</h2>
      </div>
      <div className={styles.forecastSection}>
        <div className={styles.forecastSummary}>
          <p className={styles.forecastLabel}>พลังงานที่ได้รับวันนี้</p>
          <p className={styles.forecastValue}>{actualEnergy.toFixed(2)} kWh</p>
          <p className={styles.forecastLabel}>คาดว่าวันพรุ่งนี้จะได้พลังงาน</p>
          <p className={styles.forecastValue}>{energyTomorrow.toFixed(2)} kWh</p>
        </div>
        <EnergyChart weatherData={weatherData} actualEnergy={actualEnergy} onEnergyTomorrow={setEnergyTomorrow} />
      </div>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>การแจ้งเตือนระบบ</h2>
      </div>
      {alerts.length > 0 && (
        <div className={styles.alertsContainer}>
          {alerts.map((alert, index) => (
            <AlertCard key={index} message={alert} />
          ))}
        </div>
      )}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>การตรวจจับความผิดปกติ</h2>
      </div>
      {anomaly && (
        <div className={styles.anomalyContainer}>
          <p>{anomaly.message}</p>
          {anomaly.anomaly && <p>คำแนะนำ: กรุณาตรวจสอบแผงโซล่าเซลล์</p>}
        </div>
      )}
    </div>
  );
};

export default Dashboard;