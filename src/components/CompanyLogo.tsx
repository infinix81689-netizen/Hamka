import React from 'react';
import { isValidLogoUrl } from '../utils/tbsCalculations';

interface CompanyLogoProps {
  logoUrl?: string;
  companyName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  logoUrl = '',
  companyName = 'PT. Fajar Saudara Kusuma',
  size = 'md',
  className = '',
}) => {
  const sizeClass =
    size === 'sm'
      ? 'h-8 w-8'
      : size === 'lg'
      ? 'h-14 w-14'
      : size === 'xl'
      ? 'h-20 w-20'
      : 'h-10 w-10';

  const safeLogo = logoUrl && isValidLogoUrl(logoUrl) ? logoUrl : '';

  if (safeLogo) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white border border-slate-200/80 shadow-xs ${sizeClass} ${className}`}
      >
        <img
          src={safeLogo}
          alt={`Logo ${companyName}`}
          className="h-full w-full object-contain p-0.5"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-brand-accent text-white border border-white/25 shadow-xs ${sizeClass} ${className}`}
    >
      <svg viewBox="0 0 36 36" className="h-[68%] w-[68%]" fill="none" aria-hidden="true">
        <circle cx="18" cy="18" r="15" stroke="currentColor" strokeWidth="1.8" opacity="0.45" />
        <path
          d="M18 6c-5 4.5-8 9.5-8 14.5 0 4.5 3.5 8.5 8 8.5s8-4 8-8.5C26 15.5 23 10.5 18 6z"
          fill="#FACC15"
        />
        <path
          d="M18 10v16M18 15l-4.5-3M18 19.5l5-3"
          stroke="#0F2942"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
