import '../styles/globals.css';
import { Toaster } from 'react-hot-toast';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 500,
          },
        }}
      />
    </>
  );
}
