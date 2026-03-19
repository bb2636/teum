interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  // 세로가 가로의 네배가 되도록 설정 (aspect-ratio 4:1)
  const sizeClasses = {
    sm: 'h-8 w-2',
    md: 'h-30 w-20',
    lg: 'h-32 w-8 sm:h-40 sm:w-10', // 스플래시용 더 큰 크기 (모바일 반응형)
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <img
        src="/logo.png"
        alt="teum logo"
        className={`${sizeClasses[size]} object-contain`}
        onError={(e) => {
          // Fallback if logo doesn't exist - hide the image
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      {showText && (
        <h1 className={`font-bold mt-1 ${
          size === 'lg' 
            ? 'text-4xl sm:text-5xl text-white' 
            : 'text-3xl text-[#46342c]'
        }`}>teum</h1>
      )}
    </div>
  );
}
