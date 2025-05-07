// src/components/StopLineView.tsx
"use client";

import React from 'react';

// --- INTERFACES (Confirmadas con ArrivalsView) ---
interface StopOnLine {
  stopId: string;
  stopName: string;
  sequence: number;
}

interface VehiclePosition { // Se recibe pero no se usa
  tripId: string;
  currentStopId?: string | null;
  nextStopId?: string | null;
}

interface StopLineViewProps {
  stops: StopOnLine[];
  vehicles: VehiclePosition[]; // Recibe un array vacío
  currentStopId: string; // La parada física seleccionada por el usuario
  routeColor: string;
}

// Ícono de vehículo (no se usará, pero lo dejo comentado por si acaso)
// const PinIcon = () => (/* ... SVG ... */);
// const SmallPinIcon = () => (/* ... SVG ... */);


const StopLineView: React.FC<StopLineViewProps> = ({ stops, currentStopId, routeColor }) => {
  // Ya no necesitamos la prop 'vehicles'

  if (!stops || stops.length === 0) {
    return <div className="text-center text-gray-500 py-4 text-sm">No hay datos de paradas para mostrar.</div>;
  }

  // Asegurar que las paradas estén ordenadas por secuencia
  const sortedStops = [...stops].sort((a, b) => a.sequence - b.sequence);

  return (
    // Contenedor siempre vertical
    <div className="stop-line-container">
        <div className="relative pl-3"> {/* Padding left para la línea y los puntos */}
          {/* Línea vertical de fondo */}
          {sortedStops.length > 0 && (
            <div 
              className="absolute top-3 bottom-3 left-3 w-1 transform -translate-x-1/2 rounded-full" // Ajuste de posición y grosor
              style={{ backgroundColor: `#${routeColor}30` }} // Opacidad reducida
            ></div>
          )}

          {/* Mapear Paradas */}
          {sortedStops.map((stop) => {
            const isCurrentSelectedStop = stop.stopId === currentStopId;

            return (
              <div key={stop.stopId} className="relative flex items-center py-2 group min-h-[35px]"> {/* Espaciado vertical */}
                {/* Punto de la parada */}
                <div className="absolute left-3 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                    <div 
                        className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${
                            isCurrentSelectedStop 
                                ? 'bg-blue-600 border-blue-700 scale-125 shadow-md ring-2 ring-blue-300 ring-offset-1' // Resaltado más fuerte
                                : `border-[#${routeColor}] bg-white shadow-sm group-hover:bg-gray-100`
                        }`}
                    >
                       {/* Aquí ya no mostramos íconos de vehículos */}
                    </div>
                </div>
                {/* Nombre de la parada */}
                <div className={`ml-8 text-sm transition-colors duration-150 group-hover:text-black ${
                    isCurrentSelectedStop ? 'font-semibold text-blue-700' : 'text-gray-600'
                }`}>
                  {stop.stopName}
                </div>
              </div>
            );
          })}
        </div>
    </div>
  );
};

export default StopLineView;