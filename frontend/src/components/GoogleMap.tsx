import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});
interface MapProps {
  origin?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  currentLocation?: { lat: number; lng: number };
  height?: string;
}
const GoogleMap: React.FC<MapProps> = ({
  origin,
  destination,
  currentLocation,
  height = '400px',
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLineRef = useRef<L.Polyline | null>(null);
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapRef.current) {
      const defaultCenter: [number, number] = [-1.2921, 36.8219];
      let center: [number, number] = defaultCenter;
      let zoom = 10;
      if (origin && origin.lat !== 0 && origin.lng !== 0) {
        center = [origin.lat, origin.lng];
        zoom = 13;
      } else if (destination && destination.lat !== 0 && destination.lng !== 0) {
        center = [destination.lat, destination.lng];
        zoom = 13;
      } else if (currentLocation && currentLocation.lat !== 0 && currentLocation.lng !== 0) {
        center = [currentLocation.lat, currentLocation.lng];
        zoom = 13;
      }
      mapRef.current = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    if (origin && origin.lat !== 0 && origin.lng !== 0) {
      const originMarker = L.marker([origin.lat, origin.lng], {
        icon: L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      }).addTo(map);
      originMarker.bindPopup('Origin').openPopup();
      markersRef.current.push(originMarker);
    }
    if (destination && destination.lat !== 0 && destination.lng !== 0) {
      const destMarker = L.marker([destination.lat, destination.lng], {
        icon: L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      }).addTo(map);
      destMarker.bindPopup('Destination').openPopup();
      markersRef.current.push(destMarker);
    }
    if (currentLocation && currentLocation.lat !== 0 && currentLocation.lng !== 0) {
      const currentMarker = L.marker([currentLocation.lat, currentLocation.lng], {
        icon: L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      }).addTo(map);
      currentMarker.bindPopup('Current Location');
      markersRef.current.push(currentMarker);
    }
    if (
      origin &&
      origin.lat !== 0 &&
      origin.lng !== 0 &&
      destination &&
      destination.lat !== 0 &&
      destination.lng !== 0
    ) {
      const routeLine = L.polyline(
        [
          [origin.lat, origin.lng],
          [destination.lat, destination.lng],
        ],
        {
          color: '#3388ff',
          weight: 4,
          opacity: 0.7,
          dashArray: '10, 10',
        }
      ).addTo(map);
      routeLineRef.current = routeLine;
      const bounds = L.latLngBounds(
        [origin.lat, origin.lng],
        [destination.lat, destination.lng]
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (markersRef.current.length > 0) {
      const group = new L.FeatureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    }
    return () => {
    };
  }, [origin, destination, currentLocation]);
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);
  const hasData = (origin && origin.lat !== 0 && origin.lng !== 0) ||
    (destination && destination.lat !== 0 && destination.lng !== 0) ||
    (currentLocation && currentLocation.lat !== 0 && currentLocation.lng !== 0);
  if (!hasData) {
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
        <strong>Route preview unavailable</strong>
        <div style={{ marginTop: 4 }}>
          Enter origin and destination to see the route on the map.
        </div>
      </div>
    );
  }
  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height,
        borderRadius: '8px',
        border: '1px solid #ddd',
        zIndex: 0,
      }}
    />
  );
};
export default GoogleMap;
