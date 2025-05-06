"use client";

import { useState, useEffect } from 'react';
import LineSelector from '@/components/LineSelector';
import StopSelector from '@/components/StopSelector';
import DirectionSelector from '@/components/DirectionSelector';
import ArrivalsView from '@/components/ArrivalsView';
import SearchBar from '@/components/SearchBar';
import { Route, Stop } from '@/types';

export default function Home() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cargar rutas al inicio
  useEffect(() => {
    async function fetchRoutes() {
      try {
        const response = await fetch('/api/routes');
        if (!response.ok) throw new Error('Error al cargar rutas');
        const data = await response.json();
        setRoutes(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching routes:', error);
        setLoading(false);
      }
    }

    fetchRoutes();
  }, []);

  // Resetear selecciones cuando cambia la ruta
  useEffect(() => {
    setSelectedStop(null);
    setSelectedDirection(null);
  }, [selectedRoute]);

  // Resetear dirección cuando cambia la parada
  useEffect(() => {
    setSelectedDirection(null);
  }, [selectedStop]);

  const handleSearchSelect = (stop: Stop, route: Route, direction: string) => {
    setSelectedRoute(route);
    setSelectedStop(stop);
    setSelectedDirection(direction);
    setSearchActive(false);
  };

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">¿Dónde está el subte?</h1>
          <button 
            onClick={() => setSearchActive(!searchActive)}
            className="px-4 py-2 bg-white text-blue-600 rounded-full font-medium flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Buscar
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4">
        {searchActive && (
          <div className="mb-6">
            <SearchBar onSelect={handleSearchSelect} onClose={() => setSearchActive(false)} />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {!selectedRoute && (
              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Seleccioná una línea</h2>
                <LineSelector routes={routes} onSelect={setSelectedRoute} />
              </section>
            )}

            {selectedRoute && !selectedStop && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">Seleccioná una parada</h2>
                  <button 
                    onClick={() => setSelectedRoute(null)}
                    className="text-blue-600 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Volver
                  </button>
                </div>
                <StopSelector 
                  routeId={selectedRoute.route_id} 
                  route={selectedRoute}
                  onSelect={setSelectedStop} 
                />
              </section>
            )}

            {selectedRoute && selectedStop && !selectedDirection && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">Seleccioná una dirección</h2>
                  <button 
                    onClick={() => setSelectedStop(null)}
                    className="text-blue-600 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Volver
                  </button>
                </div>
                <DirectionSelector 
                  routeId={selectedRoute.route_id} 
                  stopId={selectedStop.stop_id} 
                  route={selectedRoute}
                  stop={selectedStop}
                  onSelect={setSelectedDirection} 
                />
              </section>
            )}

            {selectedRoute && selectedStop && selectedDirection && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">Próximas llegadas</h2>
                  <button 
                    onClick={() => setSelectedDirection(null)}
                    className="text-blue-600 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Volver
                  </button>
                </div>
                <ArrivalsView 
                  routeId={selectedRoute.route_id}
                  stopId={selectedStop.stop_id}
                  direction={selectedDirection}
                  routeColor={selectedRoute.route_color || "CCCCCC"}
                  routeName={selectedRoute.route_short_name}
                  route={selectedRoute}
                  stop={selectedStop}
                />
              </section>
            )}
          </>
        )}
      </div>

      <footer className="bg-gray-800 text-white p-4 mt-12">
        <div className="max-w-5xl mx-auto text-center">
          <p>¿Dónde está el subte? © 2025 - Datos GTFS de Buenos Aires</p>
        </div>
      </footer>
    </main>
  );
}