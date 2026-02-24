import { useState, useRef, useEffect, InputHTMLAttributes } from 'react';

interface DecimalInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
    value: number | '';
    onValueChange: (value: number) => void;
}

/**
 * Input numérico que permite digitar decimais corretamente.
 * Resolve o bug onde parseFloat() remove o ponto antes do usuário terminar de digitar.
 * Converte vírgula para ponto automaticamente (padrão BR).
 */
const DecimalInput = ({ value, onValueChange, onFocus, onBlur, ...props }: DecimalInputProps) => {
    const [text, setText] = useState(value ? String(value) : '');
    const isFocused = useRef(false);

    useEffect(() => {
        if (!isFocused.current) {
            setText(value ? String(value) : '');
        }
    }, [value]);

    return (
        <input
            {...props}
            type="text"
            inputMode="decimal"
            value={text}
            onFocus={(e) => { isFocused.current = true; onFocus?.(e); }}
            onChange={e => {
                const v = e.target.value.replace(',', '.');
                if (v === '' || /^\d*\.?\d*$/.test(v)) {
                    setText(v);
                    const num = parseFloat(v);
                    if (!isNaN(num)) onValueChange(num);
                    else if (v === '') onValueChange(0);
                }
            }}
            onBlur={(e) => {
                isFocused.current = false;
                const num = parseFloat(text) || 0;
                setText(num ? String(num) : '');
                onValueChange(num);
                onBlur?.(e);
            }}
        />
    );
};

export default DecimalInput;
