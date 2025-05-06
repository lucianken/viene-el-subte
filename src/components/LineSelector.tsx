"use client";

import { Route } from '@/types';
import { useEffect, useState } from 'react';

interface LineSelectorProps {
  routes: Route[];
  onSelect: (route: Route) => void;
}

export default function LineSelector({ routes, onSelect }: LineSelectorProps) {
  const [sortedRoutes, setSortedRoutes] = useState<Route[]>([]);

  useEffect(() => {
    // Ordenar las líneas: A-E primero, luego Premetro, luego el resto
    const sorted = [...routes].sort((a, b) => {
      const nameA = a.route_short_name.toUpperCase();
      const nameB = b.route_short_name.toUpperCase();
      
      // Comprobar si es una línea principal (A-E)
      const isMainLineA = nameA >= 'A' && nameA <= 'E';
      const isMainLineB = nameB >= 'A' && nameB <= 'E';
      
      // Comprobar si es Premetro
      const isPremetroA = nameA === 'P';
      const isPremetroB = nameB === 'P';
      
      if (isMainLineA && !isMainLineB) return -1;
      if (!isMainLineA && isMainLineB) return 1;
      if (isMainLineA && isMainLineB) return nameA.localeCompare(nameB);
      
      if (isPremetroA && !isPremetroB) return -1;
      if (!isPremetroA && isPremetroB) return 1;
      
      return nameA.localeCompare(nameB);
    });
    
    setSortedRoutes(sorted);
  }, [routes]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {sortedRoutes.map(route => {
        // Determinar si necesitamos texto blanco o negro basado en el color de fondo
        const bgColor = `#${route.route_color || 'CCCCCC'}`;
        // Usar el color de texto definido en la ruta, o determinar automáticamente
        const textColor = route.route_text_color 
          ? `#${route.route_text_color}` 
          : isColorBright(bgColor) ? "#000000" : "#FFFFFF";
        
        return (
          <button
            key={route.route_id}
            onClick={() => onSelect(route)}
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 text-center flex flex-col items-center justify-center h-32"
            style={{ borderTop: `8px solid ${bgColor}` }}
          >
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
              style={{ 
                backgroundColor: bgColor,
                color: textColor
              }}
            >
              <span className="text-3xl font-bold">{route.route_short_name}</span>
            </div>
            <span className="text-sm text-gray-800 font-medium">
              {route.route_long_name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Función para determinar si un color es claro (para usar texto negro) o oscuro (para usar texto blanco)
function isColorBright(color: string): boolean {
  // Eliminar el # si existe
  const hex = color.replace('#', '');
  
  // Convertir a valores RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calcular luminosidad (fórmula estándar)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Si luminosidad > 0.5, considerar como claro
  return luminance > 0.5;
}
