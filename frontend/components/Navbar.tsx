import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '../styles/Navbar.module.css';

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isClient, setIsClient] = useState(false); // 🆕 Flag to check client-side render

  useEffect(() => {
    setIsClient(true); // ✅ Mark as client after mount

    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDate.toLocaleString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Bangkok',
  });

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarContainer}>
        <div className={styles.navbarBrand}>
          <svg className={styles.logo} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M24 45.8096C19.6865 45.8096 15.4698 44.5305 11.8832 42.134C8.29667 39.7376 5.50128 36.3314 3.85056 32.3462C2.19985 28.361 1.76794 23.9758 2.60947 19.7452C3.451 15.5145 5.52816 11.6284 8.57829 8.5783C11.6284 5.52817 15.5145 3.45101 19.7452 2.60948C23.9758 1.76795 28.361 2.19986 32.3462 3.85057C36.3314 5.50129 39.7376 8.29668 42.134 11.8833C44.5305 15.4698 45.8096 19.6865 45.8096 24L24 24L24 45.8096Z"
              fill="currentColor"
            />
          </svg>
          <h2 className={styles.brandTitle}>SolarView</h2>
        </div>
        <button className={styles.hamburger} onClick={toggleMenu}>
          <span className={isMenuOpen ? styles.hamburgerOpen : ''}></span>
          <span className={isMenuOpen ? styles.hamburgerOpen : ''}></span>
          <span className={isMenuOpen ? styles.hamburgerOpen : ''}></span>
        </button>
        <div className={`${styles.navbarLinks} ${isMenuOpen ? styles.navbarLinksOpen : ''}`}>
          <Link href="/" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>ภาพรวม</Link>
          <Link href="/panel-recommendation" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>คำแนะนำแผงโซลาร์เซลล์</Link>
          <Link href="/settings" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>การตั้งค่า</Link>
        </div>
      </div>

      {/* ✅ Only render date after client mount */}
      <div className={styles.navbarDate}>
        {isClient && <p>{formattedDate}</p>}
      </div>
    </nav>
  );
};

export default Navbar;
