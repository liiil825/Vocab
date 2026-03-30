type InputProps = {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
};

export default function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  multiline = false,
  rows = 3,
  className = ''
}: InputProps) {
  const base = 'w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors duration-200';

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className='text-xs text-text-secondary uppercase tracking-wider'>{label}</label>}
      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${base} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={base}
        />
      )}
    </div>
  );
}
