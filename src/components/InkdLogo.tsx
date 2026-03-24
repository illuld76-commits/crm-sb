import React from 'react';

interface InkdLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

const InkdLogo: React.FC<InkdLogoProps> = ({ size = 32, className = '', showText = true }) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <rect width="40" height="40" rx="10" className="fill-primary" />
        {/* Tooth curve integrated into K */}
        <path
          d="M12 10 L12 30 M12 20 L22 10 M16 16 L24 30"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dental curve accent */}
        <path
          d="M26 14 C28 12, 32 14, 30 18 C28 22, 32 24, 30 26"
          stroke="hsl(170, 50%, 70%)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {showText && (
        <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          in<span className="text-primary">KD</span>
        </span>
      )}
    </div>
  );
};

export default InkdLogo;
