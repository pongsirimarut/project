import styles from '../styles/alert-card.module.css';

interface AlertCardProps {
  message: string;
}

const AlertCard = ({ message }: AlertCardProps) => {
  return (
    <div className={styles.alertCard}>
      <p>{message}</p>
    </div>
  );
};

export default AlertCard;