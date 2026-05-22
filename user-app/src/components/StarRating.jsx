import React from 'react';

const Star = ({ size = 14, fill = 'none', stroke = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} className={className}>
    <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.402 8.168L12 18.896l-7.336 3.969 1.402-8.168L.132 9.21l8.2-1.192z" />
  </svg>
);

const StarRating = ({ value, size = 14 }) => {
  if (value === null || value === undefined) return null;
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const fillType = value >= i ? 'full' : value >= i - 0.5 ? 'half' : 'empty';
    const key = `star-${i}-${value}`;
    if (fillType === 'full') {
      stars.push(<Star key={key} size={size} fill="#F59E0B" stroke="#F59E0B" className="text-yellow-400" />);
    } else if (fillType === 'half') {
      const gradId = `grad-${i}-${Math.round(value * 10)}`;
      stars.push(
        <svg key={key} width={size} height={size} viewBox="0 0 24 24" className="text-yellow-400">
          <defs>
            <linearGradient id={gradId} x1="0" x2="1">
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.402 8.168L12 18.896l-7.336 3.969 1.402-8.168L.132 9.21l8.2-1.192z" fill={`url(#${gradId})`} stroke="#F59E0B" />
        </svg>
      );
    } else {
      stars.push(<Star key={key} size={size} fill="none" stroke="#F59E0B" className="text-yellow-400" />);
    }
  }
  return <div className="flex items-center gap-1 text-sm">{stars}</div>;
};

export default StarRating;
