"use client";

import { useEffect, useState, useRef } from 'react';
import { Stop, Route } from '@/types';

interface SearchBarProps {
  onSelect: (stop: Stop, route: Route, direction: string) => void;
  onClose: () => void;
}

export default function SearchBar({ onSelect, onClose }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Enfocar el input al montar el componente
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        searchStops();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const searchStops = async () => {
    if (searchTerm.trim().length < 2) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error('Error en la búsqueda');
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error searching stops:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para determinar si un color es claro u oscuro
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

  return (
    <div className="relative">
      <div className="flex items-center bg-white rounded-lg shadow-lg overflow-hidden">
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar por estación... (ej: 'San Pedrito')"
          className="flex-grow p-4 border-0 focus:ring-0 focus:outline-none text-gray-800"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ color: '#333333' }} // Asegurar color oscuro para el texto
        />
        {loading ? (
          <div className="pr-4">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : searchTerm ? (
          <button 
            className="p-4 text-gray-400 hover:text-gray-600"
            onClick={() => setSearchTerm('')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
        <button 
          className="p-4 text-gray-600 hover:text-gray-800 border-l"
          onClick={onClose}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Resultados de búsqueda */}
      {results.length > 0 && (
        <div className="absolute w-full bg-white mt-2 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <ul>
            {results.map((result, index) => {
              // Determinar los colores adecuados para el resultado
              const bgColor = `#${result.route.route_color || 'CCCCCC'}`;
              const textColor = isColorBright(bgColor) ? "#000000" : "#FFFFFF";
              
              return (
                <li key={`${result.stop.stop_id}-${result.route.route_id}-${index}`} className="border-b last:border-b-0">
                  <button 
                    onClick={() => onSelect(result.stop, result.route, result.direction)}
                    className="p-4 text-left w-full hover:bg-gray-50 flex items-start"
                  >
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center mr-3 shrink-0"
                      style={{ 
                        backgroundColor: bgColor,
                        color: textColor
                      }}
                    >
                      {result.route.route_short_name}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{result.stop.stop_name}</p>
                      <p className="text-sm text-gray-600">
                        Línea {result.route.route_short_name} - {result.headsign}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {searchTerm.trim().length >= 2 && results.length === 0 && !loading && (
        <div className="absolute w-full bg-white mt-2 rounded-lg shadow-lg p-4 text-center text-gray-500">
          No se encontraron resultados para "{searchTerm}"
        </div>
      )}
    </div>
  );
}