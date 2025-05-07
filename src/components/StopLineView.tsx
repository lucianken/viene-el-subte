// src/components/StopLineView.tsx
"use client";
import React, { useState, useEffect } from 'react';

// --- INTERFACES ---
interface StopOnLine {
  stopId: string;
  stopName: string;
  sequence: number;
}

interface ArrivalInfo {
  estimatedArrivalTime: number;
  delaySeconds: number;
  status: 'on-time' | 'delayed' | 'early' | 'unknown';
}

interface StopWithArrival extends StopOnLine {
  nextArrival?: ArrivalInfo;
}

interface StopLineViewProps {
  stops: StopOnLine[];
  currentStopId: string;
  routeColor: string;
  routeId: string;
  direction: string;
}

const StopLineView: React.FC<StopLineViewProps> = ({ 
  stops, 
  currentStopId, 
  routeColor,
  routeId,
  direction
}) => {
  const [stopsWithArrivals, setStopsWithArrivals] = useState<StopWithArrival[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Formatear tiempo
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  // Calcular minutos hasta arribo
  const getMinutesUntilArrival = (arrivalTimestampInSeconds: number | undefined): number => {
    if (!arrivalTimestampInSeconds) return 999;
    const arrivalTimeMs = arrivalTimestampInSeconds * 1000;
    const diffMs = arrivalTimeMs - currentTime.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60)));
  };

  // Cargar datos de arribos para todas las estaciones
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    async function loadArrivalsForAllStops() {
      if (!stops || !routeId || !direction) return;
      
      setLoading(true);
      const stopsWithArrivalsData = [...stops] as StopWithArrival[]; // Copiar stops iniciales
      
      // Para cada parada, hacer una petición para obtener su próximo arribo
      const fetchPromises = stops.map(async (stop) => {
        try {
          const response = await fetch(`/api/realtime?routeId=${routeId}&stopId=${stop.stopId}&direction=${direction}`);
          
          if (!response.ok) {
            return null; // Ignorar errores individuales
          }
          
          const data = await response.json();
          
          // Si hay arribos, tomar el primero (más cercano)
          if (data.arrivals && data.arrivals.length > 0) {
            const firstArrival = data.arrivals[0];
            return {
              stopId: stop.stopId,
              nextArrival: {
                estimatedArrivalTime: firstArrival.estimatedArrivalTime,
                delaySeconds: firstArrival.delaySeconds,
                status: firstArrival.status
              }
            };
          }
          
          return null;
        } catch (error) {
          console.error(`Error fetching arrivals for stop ${stop.stopId}:`, error);
          return null;
        }
      });
      
      // Esperar a que todas las peticiones terminen
      const results = await Promise.all(fetchPromises);
      
      // Actualizar la información de arribos para cada parada
      results.forEach(result => {
        if (result) {
          const stopIndex = stopsWithArrivalsData.findIndex(s => s.stopId === result.stopId);
          if (stopIndex >= 0) {
            stopsWithArrivalsData[stopIndex].nextArrival = result.nextArrival;
          }
        }
      });
      
      // Ordenar por secuencia
      const sortedStops = stopsWithArrivalsData.sort((a, b) => a.sequence - b.sequence);
      setStopsWithArrivals(sortedStops);
      setLoading(false);
    }
    
    loadArrivalsForAllStops();
    
    // Actualizar información cada 15 segundos
    const updateInterval = setInterval(loadArrivalsForAllStops, 15000);
    
    return () => {
      clearInterval(timer);
      clearInterval(updateInterval);
    };
  }, [stops, routeId, direction, currentStopId]);

  if (!stops || stops.length === 0) {
    return <div className="text-center text-gray-500 py-4 text-sm">No hay datos de paradas para mostrar.</div>;
  }
  
  if (loading && stopsWithArrivals.length === 0) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-sm text-gray-600">Cargando información de arribos...</span>
      </div>
    );
  }

  return (
    <div className="stop-line-container">
      <div className="relative pl-3 pr-4">
        {/* Línea vertical de fondo */}
        {stopsWithArrivals.length > 0 && (
          <div
            className="absolute top-3 bottom-3 left-3 w-1 transform -translate-x-1/2 rounded-full"
            style={{ backgroundColor: `#${routeColor}30` }}
          ></div>
        )}
        
        {/* Tabla para paradas y arribos */}
        <table className="w-full">
          <thead className="text-xs text-gray-600 border-b">
            <tr><th className="w-6"></th><th className="py-2 text-left">Estación</th><th className="py-2 text-right">Próximo arribo</th></tr>
          </thead>
          <tbody>
            {stopsWithArrivals.map((stop) => {
              const isCurrentSelectedStop = stop.stopId === currentStopId;
              const minutesToArrival = stop.nextArrival ? getMinutesUntilArrival(stop.nextArrival.estimatedArrivalTime) : 999;
              
              return (
                <tr key={stop.stopId} className={`relative group min-h-[40px] hover:bg-gray-50 transition-colors ${isCurrentSelectedStop ? 'bg-blue-50' : ''}`}>
                  <td className="relative py-3">
                    <div className="absolute left-3 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                      <div className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${isCurrentSelectedStop ? 'bg-blue-600 border-blue-700 scale-125 shadow-md ring-2 ring-blue-300 ring-offset-1' : `border-[#${routeColor}] bg-white shadow-sm group-hover:bg-gray-100`}`}></div>
                    </div>
                  </td>
                  <td className={`py-3 ${isCurrentSelectedStop ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>{stop.stopName}</td>
                  <td className="py-3 text-right">
                    {stop.nextArrival ? (
                      <div>
                        <span className={`font-semibold ${minutesToArrival <= 1 ? 'text-red-600' : 'text-blue-600'}`}>
                          {minutesToArrival === 999 ? "Sin datos" : minutesToArrival <= 0 ? "Llegando" : `${minutesToArrival} min`}
                        </span>
                        {minutesToArrival > 0 && minutesToArrival < 999 && (
                          <span className="text-xs text-gray-500 ml-1">({formatTime(stop.nextArrival.estimatedArrivalTime)})</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Sin datos</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StopLineView;