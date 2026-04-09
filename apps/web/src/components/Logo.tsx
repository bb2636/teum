interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-10 w-auto',
    md: 'h-24 w-auto',
    lg: 'h-32 sm:h-40 w-auto',
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <img
        src="/main.logo.png"
        alt="TEUM logo"
        className={`${sizeClasses[size]} object-contain`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
}
