"use client";

import { useEffect, useState, useRef, useCallback } from 'react'; // Añadido useCallback
import { Stop, Route } from '@/types';

// Definir una interfaz para los elementos en el array de resultados
interface SearchResultItem {
  stop: Stop;
  route: Route;
  direction: string;
  headsign: string;
}

interface SearchBarProps {
  onSelect: (stop: Stop, route: Route, direction: string) => void;
  onClose: () => void;
}

export default function SearchBar({ onSelect, onClose }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]); // CORREGIDO: Tipo específico en lugar de any[]
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Enfocar el input al montar el componente
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const searchStops = useCallback(async () => { // Envuelta en useCallback
    if (searchTerm.trim().length < 2) {
      setResults([]); // Limpiar resultados si el término es muy corto
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error('Error en la búsqueda');
      const data: SearchResultItem[] = await response.json(); // Asumir que la API devuelve SearchResultItem[]
      setResults(data);
    } catch (error) {
      console.error('Error searching stops:', error);
      setResults([]); // Limpiar resultados en caso de error
    } finally {
      setLoading(false);
    }
  }, [searchTerm]); // Dependencias de searchStops

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        searchStops();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, searchStops]); // CORREGIDO: Añadida searchStops como dependencia

  // Función para determinar si un color es claro u oscuro
  const isColorBright = (color: string): boolean => {
    // Eliminar el # si existe
    const hex = color.replace('#', '');
    if (hex.length !== 6 && hex.length !== 3) return false; // Manejar colores inválidos/cortos
    
    let r_hex, g_hex, b_hex;
    if (hex.length === 3) {
        r_hex = hex[0]+hex[0];
        g_hex = hex[1]+hex[1];
        b_hex = hex[2]+hex[2];
    } else {
        r_hex = hex.substring(0, 2);
        g_hex = hex.substring(2, 4);
        b_hex = hex.substring(4, 6);
    }
    
    const r = parseInt(r_hex, 16);
    const g = parseInt(g_hex, 16);
    const b = parseInt(b_hex, 16);

    // Verificar si alguno es NaN después de parseInt
    if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
    
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
            aria-label="Limpiar búsqueda"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
        <button 
          className="p-4 text-gray-600 hover:text-gray-800 border-l"
          onClick={onClose}
          aria-label="Cerrar búsqueda"
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
              // CORREGIDO: isColorBright ahora puede devolver false si el color es inválido
              const textColor = isColorBright(bgColor) ? (result.route.route_text_color ? `#${result.route.route_text_color}` : "#000000") : (result.route.route_text_color ? `#${result.route.route_text_color}` : "#FFFFFF");
              
              return (
                <li key={`${result.stop.stop_id}-${result.route.route_id}-${result.direction}-${index}`} className="border-b last:border-b-0"> {/* Asegurar key única si direction puede variar para misma stop/route */}
                  <button 
                    onClick={() => onSelect(result.stop, result.route, result.direction)}
                    className="p-4 text-left w-full hover:bg-gray-50 flex items-start"
                  >
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center mr-3 shrink-0 font-bold text-xs sm:text-sm" // Ajustado tamaño de texto
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
          {/* CORREGIDO: Uso de entidades HTML para las comillas */}
          No se encontraron resultados para &quot;{searchTerm}&quot;
        </div>
      )}
    </div>
  );
}