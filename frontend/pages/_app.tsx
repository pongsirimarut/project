import type { AppProps } from 'next/app';
import Navbar from '../components/Navbar';
import '../styles/globals.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className="app">
      <Navbar />
      <div className="content">
        <Component {...pageProps} />
      </div>
    </div>
  );
}