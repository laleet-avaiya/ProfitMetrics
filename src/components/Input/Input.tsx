import { forwardRef, type InputHTMLAttributes } from 'react';
import {
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
  inlineInputControlClass,
  inputControlClass,
} from '../../constants/ui';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, fullWidth = true, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className={fullWidth ? 'w-full min-w-0' : 'w-auto shrink-0'}>
        {label && (
          <label className={fieldLabelClass}>
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none [&>svg]:w-4 [&>svg]:h-4">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            {...props}
            onWheel={(e) => {
              if (props.type === 'number') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            className={`
              ${fullWidth ? inputControlClass : inlineInputControlClass}
              ${leftIcon ? 'pl-8' : ''}
              ${rightIcon ? 'pr-8' : ''}
              ${error ? 'border-red-500 focus:ring-red-500' : ''}
              ${props.type === 'number' ? '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none' : ''}
            `}
          />
          {rightIcon && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className={fieldErrorClass}>{error}</p>}
        {helperText && !error && <p className={fieldHintClass}>{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
