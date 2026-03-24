import React from 'react';
import logoImg from '@/assets/snapon-logo.png';

interface SnaponLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

const SnaponLogo: React.FC<SnaponLogoProps> = ({ size = 32, className = '', showText = true }) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={logoImg}
        alt="Snapon Braces"
        width={size}
        height={size}
        className="shrink-0 rounded-lg object-contain"
      />
      {showText && (
        <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          Snap<span className="text-primary">on</span> Braces
        </span>
      )}
    </div>
  );
};

export default SnaponLogo;
