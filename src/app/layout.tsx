import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Heruni Dict',
  description:
    "Ancient Armenian dictionary built on Paris Heruni's SSB methodology (Armenian / English)."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
