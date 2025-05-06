import { RouteStop, VehiclePosition } from '@/types';

interface StopLineViewProps {
  stops: RouteStop[];
  vehicles: VehiclePosition[];
  currentStopId: string;
  routeColor: string;
}

export default function StopLineView({ 
  stops, 
  vehicles, 
  currentStopId,
  routeColor
}: StopLineViewProps) {
  // Encontrar el índice de la parada actual
  const currentStopIndex = stops.findIndex(stop => stop.stopId === currentStopId);
  
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
  
  // Color de fondo y texto
  const bgColor = `#${routeColor || 'CCCCCC'}`;
  const textColor = isColorBright(bgColor) ? "#000000" : "#FFFFFF";
  
  return (
    <div className="relative pt-2 pb-12">
      {/* Línea horizontal que representa la ruta */}
      <div 
        className="absolute h-2 top-8 left-0 right-0 z-0"
        style={{ backgroundColor: bgColor }}
      ></div>
      
      {/* Estaciones */}
      <div className="flex justify-between relative z-10">
        {stops.map((stop, index) => (
          <div key={stop.stopId} className="flex flex-col items-center">
            <div 
              className={`w-4 h-4 rounded-full border-2 ${
                stop.stopId === currentStopId
                  ? 'bg-red-500 border-white'
                  : 'bg-white'
              }`}
              style={{ 
                borderColor: stop.stopId !== currentStopId ? bgColor : 'white'
              }}
            ></div>
            <span className="text-xs mt-1 transform -rotate-45 origin-top-left w-20 whitespace-nowrap overflow-hidden text-gray-800 font-medium">
              {stop.stopName}
            </span>
          </div>
        ))}
      </div>
      
      {/* Vehículos */}
      {vehicles.map((vehicle, index) => {
        // Calcular posición del vehículo
        let position = 0;
        
        if (vehicle.currentStopId) {
          const currentStopIndex = stops.findIndex(s => s.stopId === vehicle.currentStopId);
          const nextStopIndex = stops.findIndex(s => s.stopId === vehicle.nextStopId);
          
          if (currentStopIndex !== -1 && nextStopIndex !== -1) {
            // Posición entre paradas actual y siguiente
            position = currentStopIndex + (vehicle.progressPercent / 100);
          } else if (currentStopIndex !== -1) {
            position = currentStopIndex;
          }
        }
        
        // Calcular posición en porcentaje
        const totalStops = stops.length - 1;
        const percentPosition = totalStops > 0 ? (position / totalStops) * 100 : 0;
        
        return (
          <div 
            key={index}
            className="absolute z-20 -mt-1"
            style={{ 
              left: `${percentPosition}%`, 
              top: '2rem',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-white"
              style={{ 
                backgroundColor: bgColor,
                color: textColor
              }}
            >
              <span className="text-xs font-bold">🚇</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}