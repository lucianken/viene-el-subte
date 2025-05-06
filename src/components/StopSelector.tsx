
"use client";

import { useEffect, useState } from 'react';
import { Stop, Route } from '@/types';

interface StopSelectorProps {
  routeId: string;
  route: Route;
  onSelect: (stop: Stop) => void;
}

export default function StopSelector({ routeId, route, onSelect }: StopSelectorProps) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStops, setFilteredStops] = useState<Stop[]>([]);

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
    async function fetchStops() {
      try {
        setLoading(true);
        const response = await fetch(`/api/stops?routeId=${routeId}`);
        if (!response.ok) throw new Error('Error al cargar paradas');
        const data = await response.json();
        
        // Eliminar duplicados (misma parada en ambas direcciones)
        const uniqueStopMap: Record<string, Stop> = {};
        data.forEach((stop: Stop) => {
          const baseStopName = stop.stop_name;
          // Usamos el nombre como clave para eliminar duplicados
          if (!uniqueStopMap[baseStopName]) {
            uniqueStopMap[baseStopName] = stop;
          }
        });
        
        const uniqueStops = Object.values(uniqueStopMap);
        setStops(uniqueStops);
        setFilteredStops(uniqueStops);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching stops:', error);
        setLoading(false);
      }
    }

    fetchStops();
  }, [routeId]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStops(stops);
    } else {
      const filtered = stops.filter(stop => 
        stop.stop_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStops(filtered);
    }
  }, [searchTerm, stops]);

  return (
    <div>
      <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
        <div className="flex items-center">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center mr-3"
            style={{ 
              backgroundColor: bgColor,
              color: textColor
            }}
          >
            <span className="text-xl font-bold">{route.route_short_name}</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-800">{route.route_long_name}</h2>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar parada..."
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ color: '#333333' }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredStops.map(stop => (
            <button
              key={stop.stop_id}
              onClick={() => onSelect(stop)}
              className="text-left bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
              style={{ borderLeft: `4px solid ${bgColor}` }}
            >
              <h3 className="font-medium text-lg text-gray-800">{stop.stop_name}</h3>
            </button>
          ))}
          
          {filteredStops.length === 0 && (
            <div className="col-span-full text-center text-gray-700 p-8 bg-white rounded-lg">
              No se encontraron paradas que coincidan con "{searchTerm}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}