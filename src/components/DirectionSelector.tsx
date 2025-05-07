// src/components/DirectionSelector.tsx
"use client";

import { useEffect, useState } from 'react';
// Tipo de la respuesta de tu API /api/directions (el endpoint de Next.js)
import type { DirectionOption } from '@/app/api/directions/route'; 
import { Route, Stop } from '@/types';

interface DirectionSelectorProps {
  routeId: string;
  route: Route; // Objeto Route completo para info de la línea
  stop: Stop;   // Objeto Stop completo para stop.stop_name
  onSelect: (directionOption: DirectionOption) => void; // Espera el objeto DirectionOption completo
}

export default function DirectionSelector({ 
  routeId, 
  route,
  stop,
  onSelect 
}: DirectionSelectorProps) {
  const [directions, setDirections] = useState<DirectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determinar si el color es claro u oscuro para elegir el color de texto
  const isColorBright = (color: string): boolean => {
    const hex = color.replace('#', '');
    // Simple validación, puedes hacerla más robusta
    if (hex.length !== 6 && hex.length !== 3) return false; 
    
    let r_hex, g_hex, b_hex;
    if (hex.length === 3) {
        r_hex = hex.substring(0, 1) + hex.substring(0, 1);
        g_hex = hex.substring(1, 2) + hex.substring(1, 2);
        b_hex = hex.substring(2, 3) + hex.substring(2, 3);
    } else {
        r_hex = hex.substring(0, 2);
        g_hex = hex.substring(2, 4);
        b_hex = hex.substring(4, 6);
    }
    
    const r = parseInt(r_hex, 16);
    const g = parseInt(g_hex, 16);
    const b = parseInt(b_hex, 16);
    
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  };

  const routeBgColor = `#${route.route_color || '3B82F6'}`; // Azul por defecto si no hay color
  const circleTextColor = isColorBright(routeBgColor) ? (route.route_text_color ? `#${route.route_text_color}` : "#000000") : (route.route_text_color ? `#${route.route_text_color}` : "#FFFFFF");
  
  // Colores para el texto del header de la card, asumiendo fondo blanco de la card
  const headerTitleColorClass = "text-gray-800"; // ej. "Plaza de Mayo - San Pedrito"
  const headerSubtitleColorClass = "text-gray-600"; // ej. "Parada: Lima"

  useEffect(() => {
    // Asegurarse de que tenemos los datos necesarios antes de hacer fetch
    if (!routeId || !stop || !stop.stop_name) {
        setError("Información de ruta o parada no disponible.");
        setLoading(false);
        setDirections([]); // Limpiar direcciones
        return;
    }

    async function fetchDirections() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/directions?routeId=${routeId}&stopName=${encodeURIComponent(stop.stop_name)}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `Error del servidor: ${response.status}` }));
          throw new Error(errorData.error || `No se pudieron cargar las direcciones (${response.status})`);
        }
        
        const data: DirectionOption[] = await response.json();
        setDirections(data);

      } catch (err: any) {
        console.error('Error fetching directions:', err);
        setError(err.message || 'Ocurrió un error al cargar las direcciones.');
        setDirections([]); // Limpiar en caso de error
      } finally {
        setLoading(false);
      }
    }

    fetchDirections();
  }, [routeId, stop]); // Depender de routeId y del objeto stop (que contiene stop_name)

  // UI para estado de carga
  if (loading) {
    return (
      <div className="text-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
        <p className="text-gray-600">Cargando direcciones...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header de la Card que muestra la línea y parada seleccionada */}
      <div className="bg-white rounded-t-lg shadow-md p-4 mb-0.5"> {/* Use rounded-t-lg si los botones van debajo directos */}
        <div className="flex items-center">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center mr-3 font-bold text-sm shrink-0"
            style={{ 
              backgroundColor: routeBgColor,
              color: circleTextColor
            }}
          >
            {route.route_short_name}
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${headerTitleColorClass}`}>{route.route_long_name}</h2>
            <p className={`text-sm ${headerSubtitleColorClass}`}>Parada: {stop.stop_name}</p>
          </div>
        </div>
      </div>

      {/* Mostrar error si existe */}
      {error && !loading && (
        <div className="bg-white rounded-b-lg shadow-md p-4 text-center text-red-600">
          <p>{error}</p>
        </div>
      )}
      
      {/* Mostrar direcciones o mensaje de no disponibles */}
      {!error && !loading && (
        <div className="bg-white rounded-b-lg shadow-md"> {/* rounded-b-lg si el header tiene rounded-t-lg */}
          {directions.length > 0 ? (
            directions.map((directionOption) => ( // directionOption es de tipo DirectionOption
              <button
                key={directionOption.stopId} // stopId de la plataforma es único
                onClick={() => onSelect(directionOption)} // Pasa el objeto directionOption completo
                className="w-full text-left p-4 hover:bg-gray-100 transition-colors border-t border-gray-200 first:border-t-0 flex items-center"
              >
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-6 w-6 mr-3 text-blue-600 shrink-0" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-700 font-medium">{directionOption.directionDisplayName}</span>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">
              No hay direcciones disponibles para esta parada en la línea seleccionada.
            </div>
          )}
        </div>
      )}
    </div>
  );
}