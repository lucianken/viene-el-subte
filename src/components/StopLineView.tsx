// src/components/StopLineView.tsx
"use client";
import React, { useState, useEffect } from 'react'; // useCallback ya no es necesario aquí

// --- INTERFACES (Tipos que este componente espera recibir) ---

// Información de arribo para una parada en la lista
interface ArrivalInfoForDisplay {
  estimatedArrivalTime: number; // Timestamp en SEGUNDOS
  delaySeconds: number;
  status: 'on-time' | 'delayed' | 'early' | 'unknown';
}

// Estructura de cada parada con su posible arribo y timestamp de actualización
// Esta interfaz debe coincidir con `ApiStopWithCalculatedArrival` que `ArrivalsView` le pasa
interface StopDataWithArrival {
  stopId: string;
  stopName: string;
  sequence: number;
  nextArrival?: ArrivalInfoForDisplay;
  lastUpdateTimestamp?: number; // Timestamp en SEGUNDOS de la última actualización para esta parada
}

// Props que el componente recibe de ArrivalsView
interface StopLineViewProps {
  initialStopsData: StopDataWithArrival[]; // NUEVA PROP
  currentStopId: string;
  routeColor: string;
  // routeId y direction podrían no ser estrictamente necesarios si toda la lógica de datos
  // está centralizada, pero se pueden mantener por si se usan para estilos o claves.
  routeId: string; 
  direction: string;
}

const StopLineView: React.FC<StopLineViewProps> = ({ 
  initialStopsData, 
  currentStopId, 
  routeColor,
  routeId,     // Conservado por si acaso
  direction    // Conservado por si acaso
}) => {
  // El estado ahora refleja directamente los datos pasados como props
  const [stopsToDisplay, setStopsToDisplay] = useState<StopDataWithArrival[]>(initialStopsData);
  const [currentTime, setCurrentTime] = useState(new Date());
  // ELIMINADO: const [loading, setLoading] = useState(true);

  // Actualizar las paradas a mostrar si la prop `initialStopsData` cambia
  useEffect(() => {
    // Asegurarse de que los datos estén ordenados por secuencia si no vienen ya ordenados
    // Aunque la API ya debería devolverlos ordenados según route_to_stops.json
    setStopsToDisplay([...initialStopsData].sort((a, b) => a.sequence - b.sequence));
  }, [initialStopsData]);

  // Timer para la hora actual (se mantiene)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ELIMINADA: función loadArrivalsForAllStops
  // ELIMINADO: useEffect que llamaba a loadArrivalsForAllStops (inicial y en intervalo)

  // Funciones helper (se mantienen)
  const formatTime = (timestampInSeconds: number | undefined, includeSeconds = false): string => {
    if (timestampInSeconds === undefined || isNaN(timestampInSeconds)) return "N/A";
    const date = new Date(timestampInSeconds * 1000);
    return date.toLocaleTimeString('es-AR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: includeSeconds ? '2-digit' : undefined
    });
  };

  const getTimeUntilArrivalString = (arrivalTimestampInSeconds: number | undefined): string => {
    if (arrivalTimestampInSeconds === undefined || isNaN(arrivalTimestampInSeconds)) return "Sin datos";
    const arrivalTimeMs = arrivalTimestampInSeconds * 1000;
    const diffMs = arrivalTimeMs - currentTime.getTime();
    const diffSecondsTotal = Math.round(diffMs / 1000);
    if (diffSecondsTotal <= 10) return "Llegando";
    if (diffSecondsTotal < 0) return "Llegando";
    const minutes = Math.floor(diffSecondsTotal / 60);
    const seconds = diffSecondsTotal % 60;
    if (minutes > 0) return `${minutes} min ${seconds} s`;
    return `${seconds} s`;
  };

  // Renderizado condicional si no hay datos (se mantiene, pero ahora usa stopsToDisplay)
  if (!stopsToDisplay || stopsToDisplay.length === 0) {
    return <div className="text-center text-gray-500 py-4 text-sm">No hay datos de paradas para mostrar.</div>;
  }
  
  // ELIMINADO: El estado de carga principal de "Cargando información de arribos..."
  // ya que los datos vienen pre-cargados. ArrivalsView maneja el loading inicial.

  return (
    <div className="stop-line-container">
      <div className="relative pl-3 pr-4">
        {stopsToDisplay.length > 0 && (
          <div
            className="absolute top-3 bottom-3 left-3 w-1 transform -translate-x-1/2 rounded-full"
            style={{ backgroundColor: `#${routeColor}30` }}
          ></div>
        )}
        
        <table className="w-full">
          <thead className="text-xs text-gray-600 border-b">
            <tr>
                <th className="w-6"></th>
                <th className="py-2 text-left">Estación</th>
                <th className="py-2 text-right">Próximo arribo</th>
            </tr>
          </thead>
          <tbody>
            {/* MODIFICADO: Iterar sobre stopsToDisplay */}
            {stopsToDisplay.map((stop) => {
              const isCurrentSelectedStop = stop.stopId === currentStopId;
              const arrivalString = stop.nextArrival ? getTimeUntilArrivalString(stop.nextArrival.estimatedArrivalTime) : "Sin datos";
              
              let arrivalColorClass = 'text-blue-600';
              if (stop.nextArrival) {
                  const diffSecondsTotal = Math.round(((stop.nextArrival.estimatedArrivalTime * 1000) - currentTime.getTime()) / 1000);
                  if (diffSecondsTotal <= 10) arrivalColorClass = 'text-red-600 animate-pulse';
                  else if (diffSecondsTotal <= 60) arrivalColorClass = 'text-red-600';
              }
              if (arrivalString === "Sin datos") arrivalColorClass = 'text-gray-400';

              return (
                <tr key={stop.stopId} className={`relative group min-h-[40px] hover:bg-gray-50 transition-colors ${isCurrentSelectedStop ? 'bg-blue-50' : ''}`}>
                  <td className="relative py-3"> {/* ... (círculo de la parada) ... */} </td>
                  <td className={`py-3 ${isCurrentSelectedStop ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>{stop.stopName}</td>
                  <td className="py-3 text-right">
                    {stop.nextArrival ? (
                      <div>
                        <span className={`font-semibold ${arrivalColorClass}`}>
                          {arrivalString}
                        </span>
                        {arrivalString !== "Llegando" && arrivalString !== "Sin datos" && stop.nextArrival.estimatedArrivalTime && (
                          <span className="text-xs text-gray-500 ml-1">({formatTime(stop.nextArrival.estimatedArrivalTime)})</span>
                        )}
                        {/* Se mantiene la lógica de lastUpdateTimestamp si se pasa en la prop */}
                        {stop.lastUpdateTimestamp && (
                             <div className="text-xs text-gray-400">(Act: {formatTime(stop.lastUpdateTimestamp, true)})</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        Sin datos
                        {stop.lastUpdateTimestamp && (
                             <div className="text-xs text-gray-400">(Act: {formatTime(stop.lastUpdateTimestamp, true)})</div>
                        )}
                      </span>
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