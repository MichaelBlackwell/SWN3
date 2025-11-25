import { type ReactNode } from 'react';
import './MainLayout.css';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="main-layout">
      <div className="main-layout__background" aria-hidden="true">
        <div className="main-layout__gradient" />
        <div className="main-layout__grid" />
      </div>
      <main className="app-main">{children}</main>
    </div>
  );
}

