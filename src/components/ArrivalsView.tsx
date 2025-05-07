// src/components/ArrivalsView.tsx
"use client";

import { useEffect, useState, useCallback } from 'react';
import StopLineView from './StopLineView';
import { Route, Stop } from '@/types'; // Tus tipos globales

// --- INTERFACES DEL FRONTEND PARA LA RESPUESTA DE /api/realtime ---
interface ArrivalFromApi {
  tripId: string;
  routeId: string;
  headsign?: string;
  estimatedArrivalTime: number; // Timestamp en SEGUNDOS
  delaySeconds: number;
  status: 'on-time' | 'delayed' | 'early' | 'unknown';
  departureTimeFromTerminal?: string;
  vehicleId?: string;
}

interface ApiArrivalInfoForStopList {
    estimatedArrivalTime: number; // SEGUNDOS
    delaySeconds: number;
    status: 'on-time' | 'delayed' | 'early' | 'unknown';
}
interface ApiStopWithCalculatedArrival {
    stopId: string;
    stopName: string;
    sequence: number;
    nextArrival?: ApiArrivalInfoForStopList;
    lastUpdateTimestamp?: number; // Timestamp en SEGUNDOS
}

interface RealtimeDataForView { 
  arrivals: ArrivalFromApi[];
  lineStopsWithArrivals: ApiStopWithCalculatedArrival[];
  timestamp: number; // Timestamp en MILISEGUNDOS
}

interface LocalTrip {
    route_id: string; 
    service_id: string;
    trip_id: string;
    trip_headsign?: string;
    direction_id: string | number; 
}

interface ArrivalsViewProps {
  routeId: string;
  stopId: string;
  direction: string;
  routeColor: string;
  routeName: string;
  route: Route; 
  stop: Stop;   
}

export default function ArrivalsView({ 
  routeId, 
  stopId, 
  direction,
  routeColor,
  routeName,
  route,
  stop 
}: ArrivalsViewProps) {
  const [apiData, setApiData] = useState<RealtimeDataForView | null>(null);
  const [localTrips, setLocalTrips] = useState<LocalTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [updating, setUpdating] = useState(false);
  const [generalDirectionHeadsign, setGeneralDirectionHeadsign] = useState<string>("Desconocida");

  useEffect(() => {
    async function loadLocalTrips() {
      try {
        const response = await fetch('/data/trips.json'); 
        if (!response.ok) { console.warn('[ArrivalsView] Advertencia: No se pudo cargar trips.json localmente.'); setLocalTrips([]); return; }
        const data: LocalTrip[] = await response.json(); setLocalTrips(data);
      } catch (err) { console.error('[ArrivalsView] Error fatal al cargar trips.json:', err); setLocalTrips([]); }
    }
    loadLocalTrips();
  }, []);

  const getOfficialHeadsign = useCallback((currentRouteId: string, currentDirectionId: string): string => {
    if (localTrips.length === 0) return "Desconocida";
    const matchingTrip = localTrips.find(trip => 
        trip.route_id === currentRouteId &&
        trip.direction_id.toString() === currentDirectionId && 
        trip.trip_headsign && trip.trip_headsign.trim() !== ""
    );
    return matchingTrip?.trip_headsign || "Desconocida";
  }, [localTrips]);

  useEffect(() => {
    let headsignToShow = "Desconocida"; 
    const firstArrivalHeadsign = apiData?.arrivals?.[0]?.headsign;
    if (firstArrivalHeadsign && firstArrivalHeadsign.trim() !== "" && firstArrivalHeadsign.trim().toLowerCase() !== "desconocido") { headsignToShow = firstArrivalHeadsign; } 
    else if (localTrips.length > 0) { headsignToShow = getOfficialHeadsign(routeId, direction); } 
    else if (route.route_long_name) { const parts = route.route_long_name.split(' - '); const dirIndex = parseInt(direction, 10); if (parts.length === 2 && (dirIndex === 0 || dirIndex === 1)) { headsignToShow = parts[dirIndex]; } }
    setGeneralDirectionHeadsign(headsignToShow);
  }, [apiData, localTrips, routeId, direction, route, getOfficialHeadsign]);

  // --- Funciones Helper (DEBEN ESTAR COMPLETAS EN TU CÓDIGO REAL) ---
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
    const arrivalTimeMs = arrivalTimestampInSeconds * 1000; const diffMs = arrivalTimeMs - currentTime.getTime();
    const diffSecondsTotal = Math.round(diffMs / 1000);
    if (diffSecondsTotal <= 10) return "Llegando"; if (diffSecondsTotal < 0) return "Llegando";
    const minutes = Math.floor(diffSecondsTotal / 60); const seconds = diffSecondsTotal % 60;
    if (minutes > 0) return `${minutes} min ${seconds} s`; else return `${seconds} s`;
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
  
  if (loading && !apiData) { 
    return ( <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow-lg"> <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div> </div> );
  }
  if (error) { 
    return ( <div className="p-6 text-center bg-red-50 border border-red-200 text-red-700 rounded-lg shadow-lg"> <p className="font-semibold">Error al cargar datos:</p> <p className="text-sm mb-3">{error}</p> <button onClick={fetchData} className="px-4 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"> Reintentar </button> </div> );
  }
  if (!apiData) { 
      return <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow-lg">No hay datos disponibles en este momento.</div>;
  }

  return (
    <div className="bg-gray-50 rounded-lg shadow-xl overflow-hidden">
      <div className="p-4" style={{ backgroundColor: headerBgColor }}>
        <div className={`flex flex-col sm:flex-row justify-between sm:items-center gap-2 ${mainHeaderTextClass}`}>
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0 font-bold text-lg ${circleBg} ${circleText}`}>
              {routeName}
            </div>
            <div>
              <h3 className="text-xl font-bold">{route.route_long_name}</h3>
              <p className={`text-sm ${secondaryHeaderTextClass}`}>
                Parada: {stop.stop_name} - Dirección: {generalDirectionHeadsign}
              </p>
            </div>
          </div>
          <div className={`text-sm text-right sm:text-left ${secondaryHeaderTextClass}`}>
            <p className={mainHeaderTextClass}>Hora: {currentTime.toLocaleTimeString('es-AR', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</p>
            {/* CORREGIDO: Removido el ?? '...' */}
            <p>Act: {formatTime(apiData.timestamp / 1000, true)}</p> 
          </div>
        </div> {/* Cierre del flex container principal del header */}
        
        {/* CORREGIDO: Contenido del indicador de actualización DENTRO del renderizado condicional y antes del cierre del div del header */}
        {updating && (
          <div className={`mt-1 flex items-center justify-end sm:justify-start ${secondaryHeaderTextClass} opacity-75`}>
            <div 
              className="animate-spin h-4 w-4 border-2 rounded-full border-t-transparent mr-2"
              style={{ 
                borderColor: isColorBright(headerBgColor) ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', 
                borderTopColor: 'transparent' 
              }}
            ></div>
            <span className="text-xs">Actualizando...</span>
          </div>
        )}
      </div> {/* ESTE es el cierre correcto del div del header con clase "p-4" */}

      {/* Cuerpo del componente */}
      <div className="bg-white">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h4 className="text-base font-semibold mb-3 text-gray-700">Próximas llegadas</h4>
          {apiData.arrivals && apiData.arrivals.length > 0 ? (
            <ul className="space-y-3">
              {apiData.arrivals.map((arrival) => {
                const arrivalString = getTimeUntilArrivalString(arrival.estimatedArrivalTime);
                const displayHeadsign = (arrival.headsign && arrival.headsign.trim() !== "" && arrival.headsign.trim().toLowerCase() !== "desconocido") 
                                        ? arrival.headsign : generalDirectionHeadsign;
                let arrivalColorClass = 'text-blue-600';
                if (arrival.estimatedArrivalTime !== undefined) {
                    const diffSecondsTotal = Math.round(((arrival.estimatedArrivalTime * 1000) - currentTime.getTime()) / 1000);
                    if (diffSecondsTotal <= 10) arrivalColorClass = 'text-red-600 animate-pulse';
                    else if (diffSecondsTotal <= 60) arrivalColorClass = 'text-red-600';
                }
                if (arrivalString === "N/A") arrivalColorClass = 'text-gray-400';

                return (
                  <li key={`${arrival.tripId}_${arrival.estimatedArrivalTime}`} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm`} style={{ backgroundColor: headerBgColor, color: mainHeaderTextClass }}>
                      {routeName}
                    </div>
                    <div className="flex-grow">
                      <p className="font-medium text-gray-800">{displayHeadsign}</p>
                      <div className="text-sm text-gray-500 flex flex-wrap items-center gap-x-2">
                        <span className={`font-semibold ${arrivalColorClass}`}> {arrivalString} </span>
                        {arrivalString !== "Llegando" && arrivalString !== "N/A" && arrival.estimatedArrivalTime && (
                          <span className="text-xs text-gray-500">({formatTime(arrival.estimatedArrivalTime)})</span>
                        )}
                        {arrival.departureTimeFromTerminal && typeof arrival.departureTimeFromTerminal === 'string' &&
                         <span className="text-xs text-gray-400">(Inicio: {arrival.departureTimeFromTerminal.substring(0, 5)})</span>}
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