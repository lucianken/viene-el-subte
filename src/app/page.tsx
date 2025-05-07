"use client";

import { useState, useEffect } from 'react';
import LineSelector from '@/components/LineSelector';
import StopSelector from '@/components/StopSelector';
import DirectionSelector from '@/components/DirectionSelector';
import ArrivalsView from '@/components/ArrivalsView';
import SearchBar from '@/components/SearchBar';
import { Route, Stop } from '@/types';
// Importar el tipo DirectionOption de tu API
import type { DirectionOption } from '@/app/api/directions/route';


export default function Home() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  
  // CAMBIO: Almacenar el objeto DirectionOption completo
  const [selectedDirectionInfo, setSelectedDirectionInfo] = useState<DirectionOption | null>(null);
  
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
    setSelectedDirectionInfo(null); // CAMBIO
  }, [selectedRoute]);

  // Resetear dirección (selectedDirectionInfo) cuando cambia la parada
  useEffect(() => {
    setSelectedDirectionInfo(null); // CAMBIO
  }, [selectedStop]);

  // El tipo de 'directionInfoFromSearch' en handleSearchSelect dependerá de lo que tu SearchBar devuelva.
  // Idealmente, SearchBar debería devolver un objeto compatible con DirectionOption o suficiente info.
  const handleSearchSelect = (stop: Stop, route: Route, directionInfoFromSearch: any /* Reemplazar 'any' con el tipo correcto que devuelve SearchBar */) => {
    setSelectedRoute(route);
    setSelectedStop(stop);

    // Necesitas asegurar que directionInfoFromSearch tenga la estructura de DirectionOption
    // o transformarlo para que lo tenga, especialmente con 'stopId' (de plataforma) y 'rawDirectionId'.
    // Ejemplo si SearchBar ya devuelve algo compatible:
    // if (directionInfoFromSearch && typeof directionInfoFromSearch.stopId === 'string' && typeof directionInfoFromSearch.rawDirectionId === 'number') {
    //   setSelectedDirectionInfo(directionInfoFromSearch as DirectionOption);
    // } else {
    //   console.warn("La información de dirección de SearchBar no es compatible o está incompleta.");
    //   // Podrías necesitar hacer otra llamada API aquí si SearchBar no da todo.
    //   setSelectedDirectionInfo(null); // O manejarlo de otra forma.
    // }
    // Por ahora, para simplificar y si tu SearchBar está incompleto en este aspecto:
    if (directionInfoFromSearch && typeof directionInfoFromSearch === 'string') { // Si solo devuelve un ID o nombre
        console.warn("SearchBar devuelve solo un string para dirección, ArrivalsView podría no tener toda la info necesaria para /api/realtime");
        // Esto es una simplificación, necesitarías una forma de obtener el rawDirectionId y el platform stopId
        // Para un cambio mínimo y asumiendo que 'directionInfoFromSearch' es el platformStopId:
        // Y que rawDirectionId se puede inferir o no es estrictamente necesario para la UI en este punto
        // (aunque sí para /api/realtime).
        // Este es un punto débil si SearchBar no da toda la info.
        setSelectedDirectionInfo({
            stopId: directionInfoFromSearch, // Asumiendo que es el platform stopId
            lineId: route.route_id,
            selectedStopName: stop.stop_name,
            directionDisplayName: "Dirección (desde búsqueda)", // Placeholder
            rawDirectionId: 0 // Placeholder, LA API /api/realtime LO NECESITA
        });

    } else if (directionInfoFromSearch && directionInfoFromSearch.stopId && typeof directionInfoFromSearch.rawDirectionId !== 'undefined') {
        setSelectedDirectionInfo(directionInfoFromSearch as DirectionOption);
    }


    setSearchActive(false);
  };

  // La función que se pasa a DirectionSelector ahora se llama handleDirectionOptionSelected
  const handleDirectionOptionSelected = (directionOption: DirectionOption) => {
    setSelectedDirectionInfo(directionOption);
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

            {/* CAMBIO: Condición para mostrar DirectionSelector */}
            {selectedRoute && selectedStop && !selectedDirectionInfo && (
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
                  // No pasar stopId aquí ya que DirectionSelector no lo espera en sus props
                  route={selectedRoute}
                  stop={selectedStop}
                  onSelect={handleDirectionOptionSelected} // CAMBIO
                />
              </section>
            )}

            {/* CAMBIO: Condición para mostrar ArrivalsView */}
            {selectedRoute && selectedStop && selectedDirectionInfo && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">Próximas llegadas</h2>
                  <button 
                    onClick={() => setSelectedDirectionInfo(null)} // CAMBIO
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
                  stopId={selectedDirectionInfo.stopId} // CAMBIO: Usar el platformStopId de DirectionOption
                  // CAMBIO: Usar el rawDirectionId (como string) para la API /api/realtime
                  direction={selectedDirectionInfo.rawDirectionId.toString()} 
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