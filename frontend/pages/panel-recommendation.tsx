import { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import styles from '../styles/panel-recommendation.module.css';

interface WeatherData {
  solar_intensity: number;
  cloud_cover: number;
}

interface Recommendation {
  panels: number;
  totalCost: number;
  annualEnergy: number;
  annualSavings: number;
  paybackPeriod: number;
}

const PanelRecommendation = () => {
  const [electricityCost, setElectricityCost] = useState<number>(4.5);
  const [energyDemand, setEnergyDemand] = useState<number>(600);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get('http://127.0.0.1:8090/weather?city=Bangkok')
      .then((response) => {
        if (!response.data.error && response.data.cloud_cover !== undefined) {
          setWeather(response.data);
          setError(null);
        } else {
          setError('ไม่สามารถดึงข้อมูลสภาพอากาศได้');
          setWeather({ solar_intensity: 800, cloud_cover: 50 }); // ค่าเริ่มต้นถ้า API ล้มเหลว
        }
      })
      .catch((error) => {
        console.error('Error fetching weather:', error);
        setError('เกิดข้อผิดพลาดในการเชื่อมต่อกับ API สภาพอากาศ');
        setWeather({ solar_intensity: 800, cloud_cover: 50 }); // ค่าเริ่มต้นถ้า API ล้มเหลว
      });
  }, []);

  const calculateRecommendation = () => {
    if (!weather || weather.cloud_cover === undefined) {
      setError('ไม่มีข้อมูลสภาพอากาศ');
      return;
    }

    const panelWattage = 400;
    const efficiency = 0.9;
    const sunHours = 5;
    const panelCost = 10000;
    const cloudFactor = Math.max(0.1, 1 - weather.cloud_cover / 100); // ใช้ 0.1 เป็นค่าต่ำสุดถ้า cloud_cover = 100

    const dailyDemand = energyDemand / 30;
    const energyPerPanel = (panelWattage * sunHours * efficiency * cloudFactor) / 1000;

    if (energyPerPanel <= 0) {
      setError('การคำนวณล้มเหลว: พลังงานต่อแผงเป็น 0');
      return;
    }

    const panels = Math.ceil(dailyDemand / energyPerPanel);
    const totalCost = panels * panelCost;
    const annualEnergy = panels * energyPerPanel * 365;
    const annualSavings = annualEnergy * electricityCost;
    const paybackPeriod = annualSavings > 0 ? totalCost / annualSavings : Infinity; // หลีกเลี่ยง NaN

    setRecommendation({
      panels,
      totalCost,
      annualEnergy,
      annualSavings,
      paybackPeriod,
    });
    setError(null);
  };

  const exportPDF = () => {
    if (!recommendation) {
      setError('ไม่มีข้อมูลคำแนะนำ');
      return;
    }

    try {
      const doc = new jsPDF();
      doc.setFont('Arial');
      doc.setFontSize(16);
      doc.text('Solar Panel Recommendation', 20, 20);
      doc.setFontSize(12);
      doc.text(`Electricity Cost: ${electricityCost.toFixed(2)} THB/kWh`, 20, 30);
      doc.text(`Energy Demand: ${energyDemand} kWh/month`, 20, 40);
      doc.text(`Recommended Panels: ${recommendation.panels} panels`, 20, 50);
      doc.text(`Estimated Cost: ${recommendation.totalCost.toLocaleString()} THB`, 20, 60);
      doc.text(`Annual Energy Production: ${recommendation.annualEnergy.toFixed(2)} kWh`, 20, 70);
      doc.text(`Annual Savings: ${recommendation.annualSavings.toFixed(2)} THB`, 20, 80);
      doc.text(`Payback Period: ${recommendation.paybackPeriod.toFixed(1)} years`, 20, 90);
      doc.save('solar_panel_recommendation.pdf');
      setError(null);
    } catch (e) {
      console.error('Error generating PDF:', e);
      setError('ไม่สามารถสร้าง PDF ได้');
    }
  };

  return (
    <div className={styles.container}>
      <h1>คำแนะนำการติดตั้งแผงโซลาร์เซลล์</h1>
      {/* {error && <div className={styles.error}>{error}</div>} */}
      <div className={styles.inputSection}>
        <label>
          ค่าไฟต่อหน่วย (บาท/kWh):
          <input
            type="number"
            value={electricityCost}
            onChange={(e) => setElectricityCost(Number(e.target.value))}
            step="0.1"
            min="0"
          />
        </label>
        <label>
          ความต้องการพลังงาน (kWh/เดือน):
          <input
            type="number"
            value={energyDemand}
            onChange={(e) => setEnergyDemand(Number(e.target.value))}
            step="10"
            min="0"
          />
        </label>
        <button onClick={calculateRecommendation}>คำนวณ</button>
      </div>
      {recommendation && (
        <div className={styles.resultSection}>
          <h2>ผลลัพธ์</h2>
          <p>จำนวนแผงที่แนะนำ: <span className={styles.resultValue}>{recommendation.panels} แผง</span></p>
          <p>ต้นทุนโดยประมาณ: <span className={styles.resultValue}>{recommendation.totalCost.toLocaleString()} บาท</span></p>
          <p>พลังงานที่ผลิตได้ต่อปี: <span className={styles.resultValue}>{recommendation.annualEnergy.toFixed(2)} kWh</span></p>
          <p>เงินประหยัดต่อปี: <span className={styles.resultValue}>{recommendation.annualSavings.toFixed(2)} บาท</span></p>
          <p>ระยะเวลาคืนทุน: <span className={styles.resultValue}>{recommendation.paybackPeriod.toFixed(1)} ปี</span></p>
          <button onClick={exportPDF}>Export เป็น PDF</button>
        </div>
      )}
    </div>
  );
};

export default PanelRecommendation;