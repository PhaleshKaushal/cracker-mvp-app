import { motion } from 'framer-motion';

const variants = {
  primary: 'bg-pink-400 hover:bg-pink-500 text-white shadow-sm',
  secondary: 'bg-blue-400 hover:bg-blue-500 text-white shadow-sm',
  outline: 'border-2 border-pink-300 text-pink-500 hover:bg-pink-50',
  ghost: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
  soft: 'bg-pink-50 text-pink-600 hover:bg-pink-100',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  fullWidth = false,
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-xl font-semibold transition-colors duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {children}
    </motion.button>
  );
}
