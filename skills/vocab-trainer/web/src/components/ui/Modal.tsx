import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './Button';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
};

type ModalContextType = {
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ModalContext = createContext<ModalContextType | null>(null);

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModal must be used within ModalProvider');
  return context;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const showConfirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise(res => {
      resolveRef.current = res;
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    resolveRef.current?.(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolveRef.current?.(false);
  };

  useEffect(() => {
    if (!isOpen) {
      setOptions(null);
      resolveRef.current = null;
    }
  }, [isOpen]);

  return (
    <ModalContext.Provider value={{ showConfirm }}>
      {children}
      <AnimatePresence>
        {isOpen && options && (
          <>
            {/* Backdrop */}
            <motion.div
              key='backdrop'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className='fixed inset-0 z-50 bg-black/70 backdrop-blur-sm'
              onClick={handleCancel}
            />
            {/* Modal */}
            <motion.div
              key='modal'
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className='fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none'
            >
              <div className='bg-surface-elevated border border-border rounded-2xl shadow-2xl shadow-black/50 max-w-sm w-full pointer-events-auto overflow-hidden'>
                {/* Accent bar */}
                <div className={`h-1 w-full ${options.variant === 'danger' ? 'bg-danger' : 'bg-warning'}`} />

                <div className='p-6'>
                  {/* Title */}
                  <motion.h2
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.2 }}
                    className='text-xl font-bold text-text-primary mb-3'
                  >
                    {options.title}
                  </motion.h2>

                  {/* Message */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.2 }}
                    className='text-text-secondary text-sm leading-relaxed mb-6'
                  >
                    {options.message}
                  </motion.p>

                  {/* Buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.2 }}
                    className='flex gap-3'
                  >
                    <Button
                      variant='ghost'
                      className='flex-1'
                      onClick={handleCancel}
                    >
                      {options.cancelText || '取消'}
                    </Button>
                    <Button
                      variant={options.variant === 'danger' ? 'danger' : 'primary'}
                      className='flex-1'
                      onClick={handleConfirm}
                    >
                      {options.confirmText || '确定'}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ModalContext.Provider>
  );
}
