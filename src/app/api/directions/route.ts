import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const routeId = searchParams.get('routeId');
  const stopId = searchParams.get('stopId');
  
  if (!routeId || !stopId) {
    return NextResponse.json(
      { error: 'Se requieren los parámetros routeId y stopId' },
      { status: 400 }
    );
  }
  
  try {
    // Cargar los datos necesarios
    const tripsPath = path.join(process.cwd(), 'public/data/trips.json');
    const routeToStopsPath = path.join(process.cwd(), 'public/data/route_to_stops.json');
    
    if (!fs.existsSync(tripsPath) || !fs.existsSync(routeToStopsPath)) {
      return NextResponse.json(
        { error: 'No se encontraron datos necesarios' },
        { status: 404 }
      );
    }
    
    // Leer archivos
    const tripsData = fs.readFileSync(tripsPath, 'utf8');
    const routeToStopsData = fs.readFileSync(routeToStopsPath, 'utf8');
    
    const trips = JSON.parse(tripsData);
    const routeToStops = JSON.parse(routeToStopsData);
    
    // Filtrar viajes para esta ruta
    const routeTrips = trips.filter((trip: any) => trip.route_id === routeId);
    
    // Agrupar por dirección y obtener el headsign
    const directions = new Map();
    
    // Para cada dirección, verificar si la parada está en la ruta
    routeTrips.forEach((trip: any) => {
      const directionId = trip.direction_id;
      const headsign = trip.trip_headsign;
      const directionKey = `${routeId}_${directionId}`;
      
      // Verificar si la parada está en esta dirección
      const stopsInDirection = routeToStops[directionKey] || [];
      const isStopInDirection = stopsInDirection.some((stop: any) => stop.stopId === stopId);
      
      if (isStopInDirection && headsign) {
        directions.set(directionId, {
          id: directionId,
          headsign,
          directionId
        });
      }
    });
    
    // Convertir el Map a array
    const directionsArray = Array.from(directions.values());
    
    return NextResponse.json(directionsArray);
  } catch (error) {
    console.error(`Error al obtener direcciones para la ruta ${routeId} y parada ${stopId}:`, error);
    return NextResponse.json(
      { error: 'Error al obtener direcciones' },
      { status: 500 }
    );
  }
}