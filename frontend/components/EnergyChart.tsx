import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler, ChartOptions } from 'chart.js';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

interface WeatherData {
    date: string;
    solar_intensity: number;
    temperature: number;
    cloud_cover: number;
    humidity?: number;
    wind_speed?: number;
}

interface EnergyChartProps {
    weatherData: WeatherData[];
    actualEnergy: number; // เพิ่มพลังงานที่ผลิตได้จริง
    onEnergyTomorrow: (energy: number) => void;
}

const EnergyChart = ({ weatherData, actualEnergy, onEnergyTomorrow }: EnergyChartProps) => {
    const [forecastData, setForecastData] = useState<number[]>([]);
    const [dayLabels, setDayLabels] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const calculateEnergyOutput = (solarIntensity: number, cloudCover: number) => {
        const panelArea = 2;
        const efficiency = 0.2;
        const performanceRatio = 0.85;
        const sunlightHours = 6;
        const cloudFactor = Math.max(0.5, 1 - (Math.min(cloudCover, 80) / 100) * 0.5);
        const energy = (Math.max(500, solarIntensity) * panelArea * efficiency * performanceRatio * sunlightHours * cloudFactor) / 1000;
        return round(energy, 3);
    };

    useEffect(() => {
        const processData = () => {
            try {
                if (!Array.isArray(weatherData) || weatherData.length === 0) {
                    throw new Error('ไม่มีข้อมูลสภาพอากาศ');
                }

                const today = new Date('2025-06-04T00:00:00+07:00'); // วันนี้
                const weekOrder = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
                const currentDayIndex = today.getDay(); // วันพุธ = 3
                const labels: string[] = [];
                const forecastEnergies: number[] = [];

                // เพิ่มพลังงานจริงสำหรับวันนี้
                const todayDateStr = today.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
                labels.push(`พ ${todayDateStr}`); // วันนี้ (04/06/2568)
                forecastEnergies.push(actualEnergy);

                // คำนวณพลังงานพยากรณ์สำหรับ 6 วันถัดไป
                for (let i = 1; i <= 6; i++) {
                    const date = new Date(today);
                    date.setDate(today.getDate() + i);
                    const dayName = weekOrder[(currentDayIndex + i) % 7];
                    const dateStr = date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
                    labels.push(`${dayName} ${dateStr}`);

                    const matchingDay = weatherData.find(d => {
                        const dDate = new Date(d.date);
                        return dDate.toDateString() === date.toDateString();
                    }) || weatherData[0] || {
                        solar_intensity: 500,
                        cloud_cover: 50,
                        temperature: 30,
                        date: dateStr,
                    };

                    const energy = calculateEnergyOutput(
                        Number(matchingDay.solar_intensity) || 500,
                        Number(matchingDay.cloud_cover) || 50
                    );
                    forecastEnergies.push(energy);
                }

                console.log('Forecast Energies:', forecastEnergies);
                console.log('Day Labels:', labels);
                setForecastData(forecastEnergies);
                setDayLabels(labels);
                onEnergyTomorrow(forecastEnergies[1] || 0); // ส่งค่า energy ของวันพรุ่งนี้ (05/06/2568)
                setError(null);
            } catch (err: any) {
                console.error('Error processing data:', err.message);
                setError(`เกิดข้อผิดพลาด: ${err.message || 'Unknown Error'}`);
                const today = new Date('2025-06-04T00:00:00+07:00');
                const weekOrder = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
                const currentDayIndex = today.getDay();
                const labels: string[] = [];
                labels.push(`พ ${today.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/')}`);
                for (let i = 1; i <= 6; i++) {
                    const date = new Date(today);
                    date.setDate(today.getDate() + i);
                    const dayName = weekOrder[(currentDayIndex + i) % 7];
                    const dateStr = date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
                    labels.push(`${dayName} ${dateStr}`);
                }
                setDayLabels(labels);
                setForecastData([0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
                onEnergyTomorrow(0.01);
            }
        };

        processData();
    }, [weatherData, actualEnergy, onEnergyTomorrow]);

    const maxEnergy = forecastData.length > 0 ? Math.max(...forecastData) : 0;
    const minEnergy = forecastData.length > 0 ? Math.min(...forecastData) : 0;
    const yAxisMax = Math.max(0.1, maxEnergy * 1.5);
    const yAxisMin = Math.min(0, minEnergy * 0.5);

    const chartData = {
        labels: dayLabels,
        datasets: [
            {
                label: 'พลังงานที่พยากรณ์ (kWh)',
                data: forecastData,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                fill: true,
                tension: 0.2,
                pointRadius: 3,
                borderWidth: 2,
                pointHoverRadius: 5,
            },
        ],
    };

    const options: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                min: yAxisMin,
                max: yAxisMax,
                grid: { color: 'rgba(156, 173, 186, 0.1)' },
                ticks: {
                    color: '#9cadba',
                    font: { size: 12 },
                    callback: (value: number) => `${value.toFixed(2)} kWh`,
                    stepSize: (yAxisMax - yAxisMin) / 5,
                },
                title: {
                    display: true,
                    text: 'พลังงาน (kWh)',
                    color: '#9cadba',
                    font: { size: 14 },
                },
            },
            x: {
                grid: { display: false },
                ticks: {
                    color: '#9cadba',
                    font: { size: 12 },
                },
                title: {
                    display: true,
                    text: 'วัน',
                    color: '#9cadba',
                    font: { size: 14 },
                },
            },
        },
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: '#9cadba',
                    font: { size: 14 },
                },
            },
            tooltip: {
                enabled: true,
                backgroundColor: '#283239',
                titleColor: '#ffffff',
                bodyColor: '#9cadba',
                borderColor: '#3b4a54',
                borderWidth: 1,
                callbacks: {
                    label: (context: any) => `${context.parsed.y.toFixed(2)} kWh`,
                },
            },
        },
    };

    const round = (value: number, decimals: number) => {
        return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
    };

    return (
        <div style={{ width: '100%', padding: 0, position: 'relative' }}>
            {error && <div style={{ color: 'red', marginBottom: '10px', position: 'absolute', top: 0 }}>{error}</div>}
            {forecastData.length > 0 ? (
                <div style={{ height: '200px' }}>
                    <Line data={chartData} options={options} />
                </div>
            ) : (
                <p>กำลังโหลดกราฟ...</p>
            )}
        </div>
    );
};

export default EnergyChart;