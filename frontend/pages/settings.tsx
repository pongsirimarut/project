import { useState } from 'react';
import styles from '../styles/settings.module.css';

const Settings = () => {
  const [cloudCoverThreshold, setCloudCoverThreshold] = useState('50');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('cloudCoverThreshold', cloudCoverThreshold);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={styles.settingsContainer}>
      <h1>การตั้งค่า</h1>
      <div className={styles.settingsGroup}>
        <label>
          ระดับปริมาณเมฆสำหรับแจ้งเตือน (%):
          <input
            type="number"
            value={cloudCoverThreshold}
            onChange={(e) => setCloudCoverThreshold(e.target.value)}
            placeholder="เช่น 50"
          />
        </label>
        <button onClick={handleSave}>บันทึก</button>
        {saved && <p className={styles.success}>บันทึกสำเร็จ!</p>}
      </div>
    </div>
  );
};

export default Settings;