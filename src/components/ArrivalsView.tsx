// src/components/ArrivalsView.tsx
"use client";

import { useEffect, useState, useCallback } from 'react';
import StopLineView from './StopLineView';
import { Route, Stop } from '@/types'; // Tus tipos globales

// --- INTERFACES DEL FRONTEND PARA LA RESPUESTA DE /api/realtime ---

// Interfaz para un arribo individual (puede ser real o estimado)
interface ArrivalInfo { 
  tripId: string; 
  routeId: string; 
  // headsign removido
  estimatedArrivalTime: number; // SEGUNDOS
  delaySeconds: number; 
  status: 'on-time' | 'delayed' | 'early' | 'unknown'; 
  departureTimeFromTerminal?: string; 
  vehicleId?: string; 
  isEstimate?: boolean; 
}

// Para la información de arribo en la lista de paradas de la línea (StopLineView)
interface ApiArrivalInfoForStopList {
    estimatedArrivalTime: number; // SEGUNDOS
    delaySeconds: number;
    status: 'on-time' | 'delayed' | 'early' | 'unknown';
}
// Para cada parada en la lista de la línea (StopLineView)
interface ApiStopWithCalculatedArrival {
    stopId: string;
    stopName: string;
    sequence: number;
    nextArrival?: ApiArrivalInfoForStopList;
    lastUpdateTimestamp?: number; // Timestamp en SEGUNDOS
}

// Interfaz para información de frecuencia
interface FrequencyInfo {
  startTime: string;
  endTime: string;
  headwaySeconds: number;
}

// Interfaz completa de la respuesta que ArrivalsView espera de /api/realtime
interface RealtimeDataForView { 
  arrivals: ArrivalInfo[]; // Array de arribos (reales + estimados) - SIN headsign
  lineStopsWithArrivals: ApiStopWithCalculatedArrival[]; 
  timestamp: number; // Timestamp en MILISEGUNDOS
  frequency?: FrequencyInfo; // Nueva propiedad para la frecuencia
  shouldShowNoDataMessage?: boolean; // Para mostrar el mensaje de "GCBA no reporta datos"
}

// --- Interfaz de Props ---
interface ArrivalsViewProps {
  routeId: string;
  stopId: string;
  direction: string; // rawDirectionId '0' o '1'
  directionDisplayName: string; // **IMPORTANTE**: Se espera esta prop
  routeColor: string;
  routeName: string;
  route: Route; 
  stop: Stop;   
}

export default function ArrivalsView({ 
  routeId, 
  stopId, 
  direction,
  directionDisplayName, // Recibir el nombre de la dirección
  routeColor,
  routeName,
  route,
  stop 
}: ArrivalsViewProps) {
  const [apiData, setApiData] = useState<RealtimeDataForView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [updating, setUpdating] = useState(false);
  // Estados y lógica relacionados a headsign/localTrips eliminados

  // --- Funciones Helper ---
  const isColorBright = (color: string): boolean => {
    const hex = color.replace('#', ''); if (hex.length !== 6 && hex.length !== 3) return false;
    let r_hex, g_hex, b_hex; if (hex.length === 3) { r_hex = hex[0]+hex[0]; g_hex = hex[1]+hex[1]; b_hex = hex[2]+hex[2]; } else { r_hex = hex.substring(0, 2); g_hex = hex.substring(2, 4); b_hex = hex.substring(4, 6); }
    const r = parseInt(r_hex, 16); const g = parseInt(g_hex, 16); const b = parseInt(b_hex, 16); if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255; return luminance > 0.5;
  };
  const formatTime = (timestampInSeconds: number | undefined, includeSeconds = false): string => {
    if (timestampInSeconds === null || timestampInSeconds === undefined || isNaN(timestampInSeconds)) return "N/A";
    const date = new Date(timestampInSeconds * 1000); 
    if (isNaN(date.getTime())) return "Hora Inválida";
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: includeSeconds ? '2-digit' : undefined });
  };
  const getTimeUntilArrivalString = (arrivalTimestampInSeconds: number | undefined): string => {
  if (arrivalTimestampInSeconds === undefined || isNaN(arrivalTimestampInSeconds)) return "N/A"; 
  const arrivalTimeMs = arrivalTimestampInSeconds * 1000;
  const diffMs = arrivalTimeMs - currentTime.getTime();
  const diffSecondsTotal = Math.round(diffMs / 1000);
  
  // Si está llegando o ya pasó
  if (diffSecondsTotal <= 10) return "Llegando";
  if (diffSecondsTotal < 0) return "Llegando";
  
  // Si es menos de un minuto, mostrar ">1"
  if (diffSecondsTotal < 60) return ">1 min";
  
  // Redondeo pesimista (hacia arriba) para el resto
  const minutes = Math.ceil(diffSecondsTotal / 60);
  return `${minutes} min`;
};
  
  // Función para formatear los segundos en formato mm:ss
  const formatHeadwayTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  // --- Fin Funciones Helper ---
  
  const headerBgColor = `#${routeColor || '3B82F6'}`;
  const mainHeaderTextClass = isColorBright(headerBgColor) ? "text-black" : "text-white";
  const secondaryHeaderTextClass = isColorBright(headerBgColor) ? "text-gray-700" : "text-gray-200";
  const circleBg = isColorBright(headerBgColor) ? "bg-white" : `bg-black bg-opacity-20`;
  const circleText = isColorBright(headerBgColor) ? (routeColor ? `text-[#${routeColor}]` : "text-blue-600") : "text-white";

  const fetchData = useCallback(async () => {
    if (!routeId || !stopId || !direction) { setError("Faltan parámetros para cargar datos."); setLoading(false); return; }
    setUpdating(true); setError(null);
    try {
      const response = await fetch(`/api/realtime?routeId=${routeId}&stopId=${stopId}&direction=${direction}`);
      if (!response.ok) { const errData = await response.json().catch(()=>({error: `Error ${response.status} del servidor.`})); throw new Error(errData.error || 'Error al cargar datos en tiempo real'); }
      const data: RealtimeDataForView = await response.json();
      setApiData(data);
    } catch (err: unknown) { 
      console.error('[ArrivalsView] Error fetching realtime data:', err);
      if (err instanceof Error) { setError(err.message); } 
      else if (typeof err === 'string') { setError(err); }
      else { setError('No se pudieron cargar los datos. Error desconocido.'); }
      setApiData(null); 
    } finally { setLoading(false); setUpdating(false); }
  }, [routeId, stopId, direction]);

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 15000); return () => clearInterval(interval); }, [fetchData]);
  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);
  
  // Guardas para null/error/loading
  if (loading && !apiData) { 
    return ( <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow-lg"> <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div> </div> );
  }
  if (error) { 
    return ( <div className="p-6 text-center bg-red-50 border border-red-200 text-red-700 rounded-lg shadow-lg"> <p className="font-semibold">Error al cargar datos:</p> <p className="text-sm mb-3">{error}</p> <button onClick={fetchData} className="px-4 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"> Reintentar </button> </div> );
  }
  if (!apiData) { 
      return <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow-lg">No hay datos disponibles en este momento.</div>;
  }

  // A partir de aquí, apiData NO es null
  return (
    <div className="bg-gray-50 rounded-lg shadow-xl overflow-hidden">
      {/* Cabecera */}
      <div className="p-4" style={{ backgroundColor: headerBgColor }}>
        <div className={`flex flex-col sm:flex-row justify-between sm:items-center gap-2 ${mainHeaderTextClass}`}>
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0 font-bold text-lg ${circleBg} ${circleText}`}>
              {routeName}
            </div>
            <div>
              <h3 className="text-xl font-bold">{route.route_long_name}</h3>
              {/* Usar directionDisplayName de las props */}
              <p className={`text-sm ${secondaryHeaderTextClass}`}>
                Parada: {stop.stop_name} - Dirección: {directionDisplayName} 
              </p>
            </div>
          </div>
          <div className={`text-sm text-right sm:text-left ${secondaryHeaderTextClass}`}>
            <p className={mainHeaderTextClass}>Hora: {currentTime.toLocaleTimeString('es-AR', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</p>
            <p>Act: {formatTime(apiData.timestamp / 1000, true)}</p> 
          </div>
        </div> 
        
        {/* Información de frecuencia */}
        {apiData.frequency && (
          <div className={`mt-2 text-sm ${mainHeaderTextClass}`}>
            <p>En este horario ({apiData.frequency.startTime}-{apiData.frequency.endTime}) la frecuencia es de {formatHeadwayTime(apiData.frequency.headwaySeconds)} entre trenes.</p>
          </div>
        )}
        
        {updating && (
          <div className={`mt-1 flex items-center justify-end sm:justify-start ${secondaryHeaderTextClass} opacity-75`}>
            <div className="animate-spin h-4 w-4 border-2 rounded-full border-t-transparent mr-2" style={{ borderColor: isColorBright(headerBgColor) ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', borderTopColor: 'transparent' }}></div>
            <span className="text-xs">Actualizando...</span>
          </div>
        )}
      </div> 

      {/* Cuerpo del componente */}
      <div className="bg-white">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h4 className="text-base font-semibold mb-3 text-gray-700">Próximas llegadas</h4>
          
          {/* Mensaje para líneas sin datos reportados */}
          {apiData.shouldShowNoDataMessage ? (
            <div className="py-4 text-center text-red-600 font-semibold">
              El GCBA no reporta datos para esta línea
            </div>
          ) : apiData.arrivals && apiData.arrivals.length > 0 ? (
            <ul className="space-y-3">
              {apiData.arrivals.slice(0, 4).map((arrival, index) => { 
                const arrivalString = getTimeUntilArrivalString(arrival.estimatedArrivalTime);
                let arrivalColorClass = 'text-blue-600';
                if (arrival.estimatedArrivalTime !== undefined) {
                    const diffSecondsTotal = Math.round(((arrival.estimatedArrivalTime * 1000) - currentTime.getTime()) / 1000);
                    if (diffSecondsTotal <= 10) arrivalColorClass = 'text-red-600 animate-pulse';
                    else if (diffSecondsTotal <= 60) arrivalColorClass = 'text-red-600';
                }
                if (arrivalString === "N/A") arrivalColorClass = 'text-gray-400';
                
                let labelPrefix = "";
                const arrivalNumber = index + 1; 

                if (arrival.isEstimate) {
                    labelPrefix = `${arrivalNumber}. Próximo subte estimado en: `;
                } else {
                    labelPrefix = "Próximo subte en: ";
                }

                return (
                  <li key={`${arrival.tripId}_${arrivalNumber}`} className={`flex items-center gap-3 ${arrival.isEstimate ? 'opacity-75' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm`} style={{ backgroundColor: headerBgColor, color: mainHeaderTextClass }}>
                      {arrivalNumber}
                    </div>
                    <div className="flex-grow">
                      <p className="font-medium text-gray-800">
                        {labelPrefix}
                        <span className={`font-semibold ${arrivalColorClass}`}> {arrivalString} </span>
                      </p>
                      <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-2">
                        {arrivalString !== "Llegando" && arrivalString !== "N/A" && arrival.estimatedArrivalTime && (
                          <span className="ml-1">({formatTime(arrival.estimatedArrivalTime)})</span>
                        )}
                        {/* Eliminado el departureTimeFromTerminal para quitarlo de la vista */}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : ( <div className="py-4 text-center text-gray-500 text-sm"> No hay información de próximos subtes para esta parada y dirección. </div> )}
        </div>
        
        <div className="p-4 sm:p-6">
          <h4 className="text-base font-semibold mb-4 text-gray-700">Línea</h4>
          {apiData.lineStopsWithArrivals && apiData.lineStopsWithArrivals.length > 0 ? (
            <StopLineView 
              initialStopsData={apiData.lineStopsWithArrivals}
              currentStopId={stopId} 
              routeColor={routeColor}
            />
          ) : ( <div className="py-4 text-center text-gray-500 text-sm"> No se pudo cargar el recorrido de la línea. </div> )}
        </div>
      </div>
    </div>
  );
}