import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './studio.css';

export const metadata: Metadata = {
  title: 'Studio · EIXU',
};

export default function StudioLayout({ children }: { children: ReactNode }) {
  return <div className="studio-product">{children}</div>;
}
