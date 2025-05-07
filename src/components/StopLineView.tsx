// src/components/StopLineView.tsx
"use client";
import React, { useState, useEffect } from 'react';

// --- INTERFACES (Tipos que este componente espera recibir) ---
interface ArrivalInfoForDisplay {
  estimatedArrivalTime: number; // Timestamp en SEGUNDOS
  delaySeconds: number;
  status: 'on-time' | 'delayed' | 'early' | 'unknown';
}

interface StopDataWithArrival {
  stopId: string;
  stopName: string;
  sequence: number;
  nextArrival?: ArrivalInfoForDisplay;
  lastUpdateTimestamp?: number; // Timestamp en SEGUNDOS
}

interface StopLineViewProps {
  initialStopsData: StopDataWithArrival[];
  currentStopId: string;
  routeColor: string;
  // ELIMINADAS: routeId y direction ya no se usan aquí directamente
  // routeId: string; 
  // direction: string;
}

const StopLineView: React.FC<StopLineViewProps> = ({ 
  initialStopsData, 
  currentStopId, 
  routeColor,
  // ELIMINADAS de la desestructuración: routeId, direction
}) => {
  const [stopsToDisplay, setStopsToDisplay] = useState<StopDataWithArrival[]>(initialStopsData);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setStopsToDisplay([...initialStopsData].sort((a, b) => a.sequence - b.sequence));
  }, [initialStopsData]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  if (!stopsToDisplay || stopsToDisplay.length === 0) {
    return <div className="text-center text-gray-500 py-4 text-sm">No hay datos de paradas para mostrar.</div>;
  }
  
  return (
    <div className="stop-line-container">
      <div className="relative pl-3 pr-4">
        {stopsToDisplay.length > 0 && (
          <div
            className="absolute top-3 bottom-3 left-3 w-1 transform -translate-x-1/2 rounded-full"
            style={{ backgroundColor: `#${routeColor}30` }} // routeColor sí se usa
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
            {stopsToDisplay.map((stop) => {
              const isCurrentSelectedStop = stop.stopId === currentStopId; // currentStopId sí se usa
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
                  <td className="relative py-3">
                    <div className="absolute left-3 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                      {/* El color del borde del círculo usa routeColor */}
                      <div className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${isCurrentSelectedStop ? 'bg-blue-600 border-blue-700 scale-125 shadow-md ring-2 ring-blue-300 ring-offset-1' : `border-[#${routeColor}] bg-white shadow-sm group-hover:bg-gray-100`}`}></div>
                    </div>
                  </td>
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