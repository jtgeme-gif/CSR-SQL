import './globals.css';
import AuthGate from '../components/AuthGate';

export const metadata = {
  title: 'Matter Tracker',
  description: 'McGraw Morris Masud case tracking',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
