import React from 'react';

interface MapProps {
  origin?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  currentLocation?: { lat: number; lng: number };
  height?: string;
}

// Simple, Google‑free map placeholder that just shows coordinates and status.
// All real distance calculations are handled by the backend.
const GoogleMap: React.FC<MapProps> = ({
  origin,
  destination,
  currentLocation,
  height = '300px',
}) => {
  const hasData = origin || destination || currentLocation;

  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: '8px',
        border: '1px solid #ddd',
        background:
          'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #dee2e6 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '14px',
        color: '#495057',
        textAlign: 'center',
        padding: '12px',
      }}
    >
      {!hasData && (
        <>
          <strong>Route preview unavailable</strong>
          <div style={{ marginTop: 4 }}>
            Enter origin and destination to calculate distance and price.
          </div>
        </>
      )}

      {hasData && (
        <>
          <strong>Route summary (no live map)</strong>
          <div style={{ marginTop: 8 }}>
            {origin && (
              <div>
                Origin: {origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}
              </div>
            )}
            {destination && (
              <div>
                Destination: {destination.lat.toFixed(4)},{' '}
                {destination.lng.toFixed(4)}
              </div>
            )}
            {currentLocation && (
              <div>
                Current: {currentLocation.lat.toFixed(4)},{' '}
                {currentLocation.lng.toFixed(4)}
              </div>
            )}
          </div>
          <div style={{ marginTop: 8, fontSize: '12px', color: '#6c757d' }}>
            Distance and pricing are calculated using our backend routing
            service (OpenRouteService/OSRM), without Google Maps.
          </div>
        </>
      )}
    </div>
  );
};

export default GoogleMap;
