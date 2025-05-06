"use client";

import { useEffect, useState } from 'react';
import { DirectionInfo, Route, Stop } from '@/types';

interface DirectionSelectorProps {
  routeId: string;
  stopId: string;
  route: Route;
  stop: Stop;
  onSelect: (direction: string) => void;
}

export default function DirectionSelector({ 
  routeId, 
  stopId,
  route,
  stop,
  onSelect 
}: DirectionSelectorProps) {
  const [directions, setDirections] = useState<DirectionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Determinar si el color es claro u oscuro para elegir el color de texto
  const isColorBright = (color: string) => {
    // Eliminar el # si existe
    const hex = color.replace('#', '');
    
    // Convertir a valores RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calcular luminosidad
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Si luminosidad > 0.5, considerar como claro
    return luminance > 0.5;
  };

  // Color de texto basado en el color de fondo
  const bgColor = `#${route.route_color || 'CCCCCC'}`;
  const textColor = isColorBright(bgColor) ? "#000000" : "#FFFFFF";

  useEffect(() => {
    async function fetchDirections() {
      try {
        setLoading(true);
        const response = await fetch(`/api/directions?routeId=${routeId}&stopId=${stopId}`);
        if (!response.ok) throw new Error('Error al cargar direcciones');
        const data = await response.json();
        setDirections(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching directions:', error);
        setLoading(false);
      }
    }

    fetchDirections();
  }, [routeId, stopId]);

  return (
    <div>
      <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
        <div className="flex items-center">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
            style={{ 
              backgroundColor: bgColor,
              color: textColor
            }}
          >
            <span className="text-lg font-bold">{route.route_short_name}</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold">{route.route_long_name}</h2>
            <p className="text-gray-600">Parada: {stop.stop_name}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {directions.map(direction => (
            <button
              key={direction.id}
              onClick={() => onSelect(direction.id)}
              className="bg-white p-5 rounded-lg shadow hover:shadow-md transition-shadow flex items-center"
              style={{ borderLeft: `4px solid ${bgColor}` }}
            >
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                style={{ 
                  backgroundColor: bgColor,
                  color: textColor
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Dirección</h3>
                <p className="text-gray-600">{direction.headsign}</p>
              </div>
            </button>
          ))}
          
          {directions.length === 0 && (
            <div className="col-span-full text-center text-gray-500 p-8">
              No hay direcciones disponibles para esta parada
            </div>
          )}
        </div>
      )}
    </div>
  );
}