import { motion } from 'framer-motion';

type ButtonProps = {
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  className = ''
}: ButtonProps) {
  const base: Record<string, string> = {
    primary: 'bg-accent hover:bg-accent-hover text-white',
    danger: 'bg-danger/80 hover:bg-danger text-white',
    ghost: 'bg-transparent hover:bg-surface-elevated text-text-secondary border border-border'
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-5 py-2.5 text-base rounded-xl',
    lg: 'px-6 py-3 text-lg rounded-xl'
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
        ${base[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {children}
    </motion.button>
  );
}
