import React, { useState, useEffect, useRef } from 'react';
import { Form } from 'react-bootstrap';
import { bookingsAPI } from '../services/api';
interface AddressPickerProps {
  value: string;
  onChange: (address: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}
interface AddressSuggestion {
  address: string;
  lat: number;
  lng: number;
}
const AddressPicker: React.FC<AddressPickerProps> = ({
  value,
  onChange,
  placeholder = 'Enter address',
  label,
  disabled = false,
}) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (!value || value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const response = await bookingsAPI.getAddressSuggestions(value, 5);
        setSuggestions(response.data || []);
        setShowSuggestions(response.data && response.data.length > 0);
      } catch (error) {
        console.error('Failed to fetch address suggestions:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoading(false);
      }
    }, 300); 
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value]);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(true);
  };
  const handleSuggestionClick = (suggestion: AddressSuggestion) => {
    onChange(suggestion.address, { lat: suggestion.lat, lng: suggestion.lng });
    setShowSuggestions(false);
    setSuggestions([]);
  };
  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };
  return (
    <Form.Group ref={wrapperRef} style={{ position: 'relative' }}>
      {label && <Form.Label>{label}</Form.Label>}
      <Form.Control
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        disabled={disabled}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: 'white',
            border: '1px solid #ced4da',
            borderRadius: '0.375rem',
            boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
            maxHeight: '200px',
            overflowY: 'auto',
            marginTop: '2px',
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseDown={(e) => e.preventDefault()} 
              style={{
                padding: '0.75rem 1rem',
                cursor: 'pointer',
                borderBottom: index < suggestions.length - 1 ? '1px solid #e9ecef' : 'none',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              <div style={{ fontSize: '0.875rem', color: '#212529' }}>
                {suggestion.address}
              </div>
            </div>
          ))}
        </div>
      )}
      {loading && value.length >= 2 && (
        <Form.Text className="text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
          Searching for addresses...
        </Form.Text>
      )}
      {!loading && value.length < 2 && (
        <Form.Text className="text-muted">
          Type at least 2 characters to see address suggestions.
        </Form.Text>
      )}
      {!loading && value.length >= 2 && suggestions.length === 0 && showSuggestions && (
        <Form.Text className="text-muted">
          No suggestions found. Continue typing or use your address as-is.
        </Form.Text>
      )}
    </Form.Group>
  );
};
export default AddressPicker;
