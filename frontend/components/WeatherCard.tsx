import styles from '../styles/weather-card.module.css';

interface WeatherCardProps {
  title: string;
  value: string;
}

const WeatherCard = ({ title, value }: WeatherCardProps) => {
  return (
    <div className={styles.weatherCard}>
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  );
};

export default WeatherCard;