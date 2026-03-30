import { motion } from 'framer-motion';

type FadeInProps = {
  children: React.ReactNode;
  delay?: number;
  className?: string;
};

export default function FadeIn({ children, delay = 0, className = '' }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
