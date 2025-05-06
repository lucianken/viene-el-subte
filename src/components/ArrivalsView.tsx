"use client";

import { useEffect, useState } from 'react';
import { Arrival, RouteStop, VehiclePosition, Route, Stop } from '@/types';
import StopLineView from './StopLineView';

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
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updating, setUpdating] = useState(false);
  const [directionHeadsign, setDirectionHeadsign] = useState<string>("");

  // Determinar si el color es claro u oscuro para elegir el color de texto
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

  // Color de texto basado en el color de fondo
  const headerBgColor = `#${routeColor}`;
  const headerTextColor = isColorBright(headerBgColor) ? "#000000" : "#FFFFFF";

  // Función para cargar los datos
  async function fetchData() {
    try {
      setUpdating(true);
      
      // Obtener las llegadas para esta parada y dirección
      const response = await fetch(`/api/realtime?routeId=${routeId}&stopId=${stopId}&direction=${direction}`);
      if (!response.ok) throw new Error('Error al cargar datos en tiempo real');
      
      const data = await response.json();
      setArrivals(data.arrivals || []);
      setStops(data.stops || []);
      setVehicles(data.vehicles || []);
      
      // Obtener el headsign de la dirección
      if (data.arrivals && data.arrivals.length > 0) {
        setDirectionHeadsign(data.arrivals[0].headsign);
      }
      
      setLastUpdate(new Date());
      setError(null);
    } catch (error) {
      console.error('Error fetching realtime data:', error);
      setError('No se pudieron cargar los datos. Intenta nuevamente.');
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  }

  // Cargar datos iniciales
  useEffect(() => {
    fetchData();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval);
  }, [routeId, stopId, direction]);

  // Actualizar hora actual cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Función para determinar el color de estado
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-time': return 'text-green-600';
      case 'delayed': return 'text-red-600';
      case 'early': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Cabecera con info de tiempo */}
      <div 
        className="p-4"
        style={{ 
          backgroundColor: headerBgColor,
          color: headerTextColor 
        }}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
              style={{ 
                backgroundColor: headerTextColor,
                color: headerBgColor
              }}
            >
              <span className="text-lg font-bold">{routeName}</span>
            </div>
            <div>
              <h3 className="text-xl font-bold">{route.route_long_name}</h3>
              <p className="text-sm">
                Parada: {stop.stop_name} - 
                Dirección: {directionHeadsign || "Desconocida"}
              </p>
            </div>
          </div>
          <div className="text-sm">
            <p>Hora actual: {formatTime(currentTime)}</p>
            <p>Última actualización: {lastUpdate ? formatTime(lastUpdate) : '...'}</p>
          </div>
        </div>
        {updating && (
          <div className="mt-1 flex items-center">
            <div className="animate-spin h-4 w-4 border-2 rounded-full border-t-transparent mr-2"
                 style={{ borderColor: headerTextColor, borderTopColor: 'transparent' }}></div>
            <span className="text-sm">Actualizando...</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-500">
          <p>{error}</p>
          <button 
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div>
          {/* Sección de próximas llegadas */}
          <div className="p-6 border-b">
            <h4 className="text-lg font-semibold mb-4">Próximas llegadas</h4>
            
            {arrivals.length > 0 ? (
              <ul className="space-y-4">
                {arrivals.map((arrival) => (
                  <li key={arrival.tripId} className="flex items-start">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0"
                      style={{ 
                        backgroundColor: headerBgColor,
                        color: headerTextColor 
                      }}
                    >
                      <span className="text-xl font-bold">{routeName}</span>
                    </div>
                    <div>
                      <p className="font-medium">{arrival.headsign}</p>
                      <p className="text-sm">
                        <span className={`font-bold ${getStatusColor(arrival.status)}`}>
                          {typeof arrival.delay === 'number' 
                            ? Math.round(arrival.delay / 60) 
                            : Math.round(parseInt(arrival.delay) / 60)} minutos
                        </span>
                        <span className="text-gray-500 ml-2">
                          (Salió de terminal a las {arrival.departureTime})
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No hay próximos subtes en esta parada
              </div>
            )}
          </div>
          
          {/* Sección de visualización de la línea */}
          <div className="p-6">
            <h4 className="text-lg font-semibold mb-4">Ubicación de los subtes</h4>
            <StopLineView 
              stops={stops}
              vehicles={vehicles}
              currentStopId={stopId}
              routeColor={routeColor}
            />
          </div>
        </div>
      )}
    </div>
  );
}