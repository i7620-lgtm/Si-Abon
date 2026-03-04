import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issue in React
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  center: [number, number];
  zoom?: number;
  radius?: number; // Geofence radius in meters
  markers?: { lat: number; lng: number; popup?: string }[];
  onLocationSelect?: (lat: number, lng: number) => void;
  interactive?: boolean;
}

function LocationSelector({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export default function LeafletMap({ center, zoom = 15, radius, markers, onLocationSelect, interactive = true }: MapProps) {
  return (
    <MapContainer 
      center={center} 
      zoom={zoom} 
      scrollWheelZoom={interactive}
      dragging={interactive}
      className="w-full h-full rounded-xl z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapUpdater center={center} />

      {/* Geofence Circle */}
      {radius && (
        <Circle 
          center={center} 
          radius={radius} 
          pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2 }} 
        />
      )}

      {/* Markers */}
      {markers?.map((m, i) => (
        <Marker key={i} position={[m.lat, m.lng]}>
        </Marker>
      ))}

      {/* Main Center Marker (Office) */}
      {!markers && <Marker position={center} />}

      {onLocationSelect && <LocationSelector onSelect={onLocationSelect} />}
    </MapContainer>
  );
}
