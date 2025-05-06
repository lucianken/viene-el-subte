import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const routeId = searchParams.get('routeId');
  const stopId = searchParams.get('stopId');
  const direction = searchParams.get('direction');
  
  if (!routeId || !stopId || !direction) {
    return NextResponse.json(
      { error: 'Se requieren los parámetros routeId, stopId y direction' },
      { status: 400 }
    );
  }
  
  try {
    // Para el MVP, simularemos datos en tiempo real
    // En una implementación real, aquí se consultaría tu API externa
    
    // Cargar datos necesarios
    const routeToStopsPath = path.join(process.cwd(), 'public/data/route_to_stops.json');
    const routesPath = path.join(process.cwd(), 'public/data/routes.json');
    const tripsPath = path.join(process.cwd(), 'public/data/trips.json');
    
    if (!fs.existsSync(routeToStopsPath) || !fs.existsSync(routesPath) || !fs.existsSync(tripsPath)) {
      return NextResponse.json(
        { error: 'No se encontraron datos necesarios' },
        { status: 404 }
      );
    }
    
    // Leer archivos
    const routeToStopsData = fs.readFileSync(routeToStopsPath, 'utf8');
    const routesData = fs.readFileSync(routesPath, 'utf8');
    const tripsData = fs.readFileSync(tripsPath, 'utf8');
    
    const routeToStops = JSON.parse(routeToStopsData);
    const routes = JSON.parse(routesData);
    const trips = JSON.parse(tripsData);
    
    // Obtener las paradas en esta dirección
    const directionKey = `${routeId}_${direction}`;
    const stopsInDirection = routeToStops[directionKey] || [];
    
    // Encontrar el viaje representativo para esta dirección
    const directionalTrips = trips.filter(
      (trip: any) => trip.route_id === routeId && trip.direction_id === direction
    );
    
    // Para el MVP, simular llegadas
    const now = new Date();
    
    // Generar llegadas simuladas
    const arrivals = [];
    
    // Si hay viajes, simular algunos arribos
    if (directionalTrips.length > 0) {
      const trip = directionalTrips[0];
      
      // Simular de 1 a 3 próximas llegadas (siempre al menos una)
      const numArrivals = 1 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < numArrivals; i++) {
        // Tiempo aleatorio entre 2 y 15 minutos
        const minutesUntilArrival = 2 + Math.floor(Math.random() * 14);
        
        // Retraso aleatorio entre 0 y 5 minutos
        const delayMinutes = Math.floor(Math.random() * 6);
        
        // Estado basado en el retraso
        let status = 'on-time';
        if (delayMinutes > 3) status = 'delayed';
        else if (delayMinutes > 0) status = 'early';
        
        // Hora de salida (60 minutos antes de la llegada)
        const departureTime = new Date(now);
        departureTime.setMinutes(departureTime.getMinutes() - 60 + delayMinutes);
        
        // Hora programada
        const scheduledTime = new Date(now);
        scheduledTime.setMinutes(scheduledTime.getMinutes() + minutesUntilArrival);
        
        // Hora estimada (con retraso)
        const estimatedTime = new Date(scheduledTime);
        estimatedTime.setMinutes(estimatedTime.getMinutes() + delayMinutes);
        
        // Agregar a la lista de llegadas
        arrivals.push({
          tripId: trip.trip_id,
          routeId: routeId,
          routeName: routes.find((r: any) => r.route_id === routeId)?.route_short_name || '',
          headsign: trip.trip_headsign || '',
          scheduledTime: scheduledTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          estimatedTime: estimatedTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          delay: delayMinutes * 60, // en segundos
          status,
          departureTime: departureTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        });
      }
      
      // Ordenar por tiempo de llegada
      arrivals.sort((a: any, b: any) => {
        const timeA = new Date(`2025-01-01T${a.estimatedTime}`);
        const timeB = new Date(`2025-01-01T${b.estimatedTime}`);
        return timeA.getTime() - timeB.getTime();
      });
    }
    
    // Simular posiciones de vehículos
    const vehicles = [];
    
    // Si hay llegadas, simular vehículos en la ruta
    if (arrivals.length > 0 && stopsInDirection.length > 0) {
      // El índice de la parada actual
      const currentStopIndex = stopsInDirection.findIndex((stop: any) => stop.stopId === stopId);
      
      if (currentStopIndex !== -1) {
        // Para cada llegada, simular un vehículo
        for (let i = 0; i < arrivals.length; i++) {
          // Calcular posición basada en tiempo de llegada
          // Asegurarnos de que delay sea tratado como número
          const delayValue = typeof arrivals[i].delay === 'number' ? 
            arrivals[i].delay : 
            Number(arrivals[i].delay);
          
          const minutesUntilArrival = delayValue / 60;
          let vehicleStopIndex = currentStopIndex;
          
          // Ajustar posición según el tiempo de llegada
          if (minutesUntilArrival > 10) {
            // Está lejos, a varias paradas de distancia
            vehicleStopIndex = Math.max(0, currentStopIndex - 4);
          } else if (minutesUntilArrival > 5) {
            // A 2-3 paradas de distancia
            vehicleStopIndex = Math.max(0, currentStopIndex - 2);
          } else if (minutesUntilArrival > 2) {
            // A 1 parada de distancia
            vehicleStopIndex = Math.max(0, currentStopIndex - 1);
          }
          
          // Progreso en porcentaje entre la parada actual y la siguiente
          const progressPercent = Math.min(100, Math.max(0, 
            (minutesUntilArrival <= 2) ? 100 - (minutesUntilArrival * 50) : 0
          ));
          
          // Agregar vehículo
          vehicles.push({
            tripId: arrivals[i].tripId,
            currentStopId: stopsInDirection[vehicleStopIndex]?.stopId || null,
            nextStopId: vehicleStopIndex < stopsInDirection.length - 1 
              ? stopsInDirection[vehicleStopIndex + 1]?.stopId 
              : null,
            progressPercent: progressPercent
          });
        }
      }
    }
    
    return NextResponse.json({
      arrivals,
      stops: stopsInDirection,
      vehicles,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error(`Error al obtener datos en tiempo real: ${error}`);
    return NextResponse.json(
      { error: 'Error al obtener datos en tiempo real' },
      { status: 500 }
    );
  }
}