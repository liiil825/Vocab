import { motion } from 'framer-motion';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
};

export default function Card({ children, className = '', hover = true }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={hover ? { scale: 1.01, borderColor: '#52525b' } : {}}
      className={`
        bg-surface border border-border rounded-2xl p-6
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
