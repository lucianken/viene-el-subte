// src/components/ArrivalsView.tsx
"use client";

import { useEffect, useState } from 'react';
import StopLineView from './StopLineView';
import { Route, Stop } from '@/types';

// --- INTERFACES (Confirmadas con la última versión de /api/realtime) ---
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

interface StopOnLine {
  stopId: string;
  stopName: string;
  sequence: number;
}

interface VehiclePosition {
  tripId: string;
  currentStopId?: string | null;
  nextStopId?: string | null;
}

interface ArrivalsViewApiResponse { 
  arrivals: ArrivalFromApi[];
  stops: StopOnLine[];
  vehicles: VehiclePosition[];
  timestamp: number; // Timestamp en MILISEGUNDOS
}

// --- OTROS TIPOS ---
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
  const [apiData, setApiData] = useState<ArrivalsViewApiResponse | null>(null);
  const [localTrips, setLocalTrips] = useState<LocalTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [updating, setUpdating] = useState(false);
  const [generalDirectionHeadsign, setGeneralDirectionHeadsign] = useState<string>("Desconocida");

  // Cargar trips.json localmente
  useEffect(() => {
    async function loadLocalTrips() {
      try {
        const response = await fetch('/data/trips.json'); 
        if (!response.ok) {
          console.warn('Advertencia: No se pudo cargar trips.json localmente. El headsign podría ser menos preciso.');
          setLocalTrips([]); 
          return;
        }
        const data: LocalTrip[] = await response.json();
        setLocalTrips(data);
      } catch (err) {
        console.error('Error fatal al cargar trips.json:', err);
        setLocalTrips([]); 
      }
    }
    loadLocalTrips();
  }, []);

  // Obtener headsign oficial (si trips.json está disponible)
  const getOfficialHeadsign = (currentRouteId: string, currentDirectionId: string): string => {
    if (localTrips.length === 0) return "Desconocida"; // No intentar si falló la carga
    const matchingTrip = localTrips.find(trip => 
        trip.route_id === currentRouteId &&
        trip.direction_id.toString() === currentDirectionId && 
        trip.trip_headsign && trip.trip_headsign.trim() !== ""
    );
    return matchingTrip?.trip_headsign || "Desconocida";
  };

  // Calcular el headsign general a mostrar
  useEffect(() => {
    let headsignToShow = "Desconocida";
    const firstArrivalHeadsign = apiData?.arrivals?.[0]?.headsign;

    // Prioridad 1: Headsign que viene del API (si es válido)
    if (firstArrivalHeadsign && firstArrivalHeadsign.trim() !== "" && firstArrivalHeadsign.trim().toLowerCase() !== "desconocido") {
      headsignToShow = firstArrivalHeadsign;
    } 
    // Prioridad 2: Headsign de trips.json local
    else if (localTrips.length > 0) { 
      headsignToShow = getOfficialHeadsign(routeId, direction);
    } 
    // Prioridad 3: Fallback con route_long_name
    else if (route.route_long_name) {
        const parts = route.route_long_name.split(' - ');
        const dirIndex = parseInt(direction, 10);
        if (parts.length === 2 && (dirIndex === 0 || dirIndex === 1)) {
            headsignToShow = parts[dirIndex];
        }
    }
    setGeneralDirectionHeadsign(headsignToShow);
  }, [apiData, localTrips, routeId, direction, route.route_long_name]);

  // --- Funciones Helper ---
  const isColorBright = (color: string): boolean => {
    const hex = color.replace('#', '');
    if (hex.length !== 6 && hex.length !== 3) return false;
    let r_hex, g_hex, b_hex;
    if (hex.length === 3) { r_hex = hex[0]+hex[0]; g_hex = hex[1]+hex[1]; b_hex = hex[2]+hex[2]; }
    else { r_hex = hex.substring(0, 2); g_hex = hex.substring(2, 4); b_hex = hex.substring(4, 6); }
    const r = parseInt(r_hex, 16); const g = parseInt(g_hex, 16); const b = parseInt(b_hex, 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  };

  const formatTime = (timestampInput: number | Date | undefined, includeSeconds = false): string => {
    if (timestampInput === null || timestampInput === undefined) return "N/A";
    // Asume timestamp en milisegundos ahora, porque la API lo convierte
    const date = typeof timestampInput === 'number' ? new Date(timestampInput) : timestampInput; 
    if (isNaN(date.getTime())) return "Hora Inválida";
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit', second: includeSeconds ? '2-digit' : undefined
    });
  };

  const getMinutesUntilArrival = (arrivalTimestampInSeconds: number | undefined): number => {
    if (arrivalTimestampInSeconds === undefined || isNaN(arrivalTimestampInSeconds)) {
        console.warn("getMinutesUntilArrival recibió un timestamp inválido:", arrivalTimestampInSeconds);
        return 999; // Devolver un número grande para indicar error/desconocido
    }
    const arrivalTimeMs = arrivalTimestampInSeconds * 1000;
    const diffMs = arrivalTimeMs - currentTime.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60)));
  };

  // --- Colores ---
  const headerBgColor = `#${routeColor || '3B82F6'}`;
  const mainHeaderTextClass = isColorBright(headerBgColor) ? "text-black" : "text-white";
  const secondaryHeaderTextClass = isColorBright(headerBgColor) ? "text-gray-700" : "text-gray-200";
  const circleBg = isColorBright(headerBgColor) ? "bg-white" : `bg-black bg-opacity-20`;
  const circleText = isColorBright(headerBgColor) ? (routeColor ? `text-[#${routeColor}]` : "text-blue-600") : "text-white";

  // --- Fetching ---
  const fetchData = async () => {
    if (!routeId || !stopId || !direction) {
        setError("Faltan parámetros para cargar datos.");
        setLoading(false); // Detener carga si faltan parámetros
        return;
    }
    setUpdating(true); setError(null);
    try {
      const response = await fetch(`/api/realtime?routeId=${routeId}&stopId=${stopId}&direction=${direction}`);
      if (!response.ok) {
        const errData = await response.json().catch(()=>({error: `Error ${response.status} del servidor.`}));
        throw new Error(errData.error || 'Error al cargar datos en tiempo real');
      }
      const data: ArrivalsViewApiResponse = await response.json();
      setApiData(data);
    } catch (err: any) {
      console.error('Error fetching realtime data:', err);
      setError(err.message || 'No se pudieron cargar los datos.');
      setApiData(null); 
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchData(); // Carga inicial
    const interval = setInterval(fetchData, 15000); // Actualizar cada 15s
    return () => clearInterval(interval);
  }, [routeId, stopId, direction]);

  // Timer para la hora actual
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // --- RENDERIZADO ---
  if (loading && !apiData) { // Mostrar loading solo la primera vez
    return (
      <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) { // Mostrar error si existe
    return (
      <div className="p-6 text-center bg-red-50 border border-red-200 text-red-700 rounded-lg shadow-lg">
        <p className="font-semibold">Error al cargar datos:</p>
        <p className="text-sm mb-3">{error}</p>
        <button 
          onClick={fetchData}
          className="px-4 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }
  
  if (!apiData) { // Si no hay datos después de cargar (y no hay error ni loading)
      return <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow-lg">No hay datos disponibles en este momento.</div>;
  }

  // --- Renderizado Principal ---
  return (
    <div className="bg-gray-50 rounded-lg shadow-xl overflow-hidden">
      {/* Cabecera */}
      <div className="p-4" style={{ backgroundColor: headerBgColor }}>
        <div className={`flex flex-col sm:flex-row justify-between sm:items-center gap-2 ${mainHeaderTextClass}`}>
          <div className="flex items-center">
            <div 
              className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0 font-bold text-lg ${circleBg} ${circleText}`}
            >
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
            <p className={mainHeaderTextClass}>Hora: {formatTime(currentTime, true)}</p>
            <p>Act: {formatTime(apiData.timestamp) ?? '...'}</p>
          </div>
        </div>
        {updating && (
          <div className={`mt-1 flex items-center justify-end sm:justify-start ${secondaryHeaderTextClass} opacity-75`}>
            <div className="animate-spin h-4 w-4 border-2 rounded-full border-t-transparent mr-2"
                 style={{ borderColor: isColorBright(headerBgColor) ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', borderTopColor: 'transparent' }}></div>
            <span className="text-xs">Actualizando...</span>
          </div>
        )}
      </div>

      {/* Cuerpo */}
      <div className="bg-white">
        {/* Próximas Llegadas */}
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h4 className="text-base font-semibold mb-3 text-gray-700">Próximas llegadas</h4>
          {apiData.arrivals && apiData.arrivals.length > 0 ? (
            <ul className="space-y-3">
              {apiData.arrivals.map((arrival) => {
                const minutesToArrival = getMinutesUntilArrival(arrival.estimatedArrivalTime);
                const displayHeadsign = (arrival.headsign && arrival.headsign.trim() !== "" && arrival.headsign.trim().toLowerCase() !== "desconocido") 
                                        ? arrival.headsign 
                                        : generalDirectionHeadsign;
                return (
                  <li key={arrival.tripId + arrival.estimatedArrivalTime} className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                      style={{ backgroundColor: headerBgColor, color: mainHeaderTextClass }}
                    >
                      {routeName}
                    </div>
                    <div className="flex-grow">
                      <p className="font-medium text-gray-800">{displayHeadsign}</p>
                      <div className="text-sm text-gray-500 flex flex-wrap items-center gap-x-2">
                        <span className={`font-semibold ${minutesToArrival <= 1 ? 'text-red-600' : 'text-blue-600'}`}>
                          {minutesToArrival === 999 ? "N/A" : (
                            minutesToArrival <= 0 
                              ? "Llegando" 
                              : `${minutesToArrival} min (${formatTime(new Date(arrival.estimatedArrivalTime * 1000))})`
                          )}
                        </span>
                        {arrival.departureTimeFromTerminal && typeof arrival.departureTimeFromTerminal === 'string' &&
                         <span className="text-xs text-gray-500">(Reporte de inicio de servicio: {arrival.departureTimeFromTerminal.substring(0, 5)})</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-4 text-center text-gray-500 text-sm">
              No hay información de próximos subtes para esta parada y dirección.
            </div>
          )}
        </div>
        
        {/* Ubicación (Solo Línea) */}
        <div className="p-4 sm:p-6">
          <h4 className="text-base font-semibold mb-4 text-gray-700">Línea</h4>
          {apiData.stops && apiData.stops.length > 0 ? (
            <StopLineView 
              stops={apiData.stops}
              currentStopId={stopId} 
              routeColor={routeColor}
              routeId={routeId}
              direction={direction}
            />
          ) : ( 
            <div className="py-4 text-center text-gray-500 text-sm">
                No se pudo cargar el recorrido de la línea.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}