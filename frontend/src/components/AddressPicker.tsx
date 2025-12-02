import React from 'react';
import { Form } from 'react-bootstrap';

interface AddressPickerProps {
  value: string;
  onChange: (address: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}

// Simple Google‑free address input.
// We let the backend handle geocoding and distance; this is just a text box.
const AddressPicker: React.FC<AddressPickerProps> = ({
  value,
  onChange,
  placeholder = 'Enter address',
  label,
  disabled = false,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  return (
    <Form.Group>
      {label && <Form.Label>{label}</Form.Label>}
      <Form.Control
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        autoComplete="off"
      />
      <Form.Text className="text-muted">
        Type the address (we&apos;ll approximate location and distance on the server).
      </Form.Text>
    </Form.Group>
  );
};

export default AddressPicker;
