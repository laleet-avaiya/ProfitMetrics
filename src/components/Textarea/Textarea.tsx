import { forwardRef, type TextareaHTMLAttributes } from 'react';
import {
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
  textareaControlClass,
} from '../../constants/ui';

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  /** Shows a subtle "Optional" tag beside the label */
  optional?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, fullWidth = true, optional = false, rows = 3, ...props }, ref) => {
    const minHeight = Math.max(72, (rows ?? 3) * 24 + 16);

    return (
      <div className={fullWidth ? 'w-full min-w-0' : 'w-auto shrink-0'}>
        {label ? (
          <div className="mb-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <label className={`${fieldLabelClass} mb-0`}>
                {label}
                {props.required ? <span className="text-red-500 ml-1">*</span> : null}
              </label>
              {optional && !props.required ? (
                <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700/60 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  Optional
                </span>
              ) : null}
            </div>
            {helperText && !error ? (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {helperText}
              </p>
            ) : null}
          </div>
        ) : helperText && !error ? (
          <p className={`${fieldHintClass} mb-1.5`}>{helperText}</p>
        ) : null}
        <textarea
          ref={ref}
          rows={rows}
          {...props}
          style={{ minHeight: `${minHeight}px`, ...props.style }}
          className={`${textareaControlClass} block w-full leading-relaxed placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
            error ? 'border-red-500 focus:ring-red-500' : ''
          }`}
        />
        {error && <p className={fieldErrorClass}>{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
