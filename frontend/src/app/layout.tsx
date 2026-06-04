import type { Metadata } from 'next';
import 'reactflow/dist/style.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Unnatify CRM',
  description: 'Automation-first CRM for lead conversion',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
