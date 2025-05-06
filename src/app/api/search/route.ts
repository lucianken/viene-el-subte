import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json([]);
    }
    
    // Cargar datos necesarios
    const stopsPath = path.join(process.cwd(), 'public/data/stops.json');
    const routesPath = path.join(process.cwd(), 'public/data/routes.json');
    const tripsPath = path.join(process.cwd(), 'public/data/trips.json');
    const routeToStopsPath = path.join(process.cwd(), 'public/data/route_to_stops.json');
    
    if (!fs.existsSync(stopsPath) || !fs.existsSync(routesPath) || 
        !fs.existsSync(tripsPath) || !fs.existsSync(routeToStopsPath)) {
      return NextResponse.json(
        { error: 'No se encontraron datos necesarios' },
        { status: 404 }
      );
    }
    
    // Leer archivos
    const stopsData = fs.readFileSync(stopsPath, 'utf8');
    const routesData = fs.readFileSync(routesPath, 'utf8');
    const tripsData = fs.readFileSync(tripsPath, 'utf8');
    const routeToStopsData = fs.readFileSync(routeToStopsPath, 'utf8');
    
    const stops = JSON.parse(stopsData);
    const routes = JSON.parse(routesData);
    const trips = JSON.parse(tripsData);
    const routeToStops = JSON.parse(routeToStopsData);
    
    // Filtrar paradas por nombre
    const queryLower = query.toLowerCase();
    const matchingStops = stops.filter((stop: any) => 
      stop.stop_name.toLowerCase().includes(queryLower)
    );
    
    // Limitar a 20 resultados para evitar respuestas muy grandes
    const limitedStops = matchingStops.slice(0, 20);
    
    // Para cada parada, buscar en qué rutas aparece
    const results = [];
    
    for (const stop of limitedStops) {
      // Buscar en cada dirección de cada ruta
      for (const route of routes) {
        for (const directionId of ['0', '1']) {
          const directionKey = `${route.route_id}_${directionId}`;
          const stopsInDirection = routeToStops[directionKey] || [];
          
          // Verificar si la parada está en esta dirección
          const isStopInDirection = stopsInDirection.some((routeStop: any) => 
            routeStop.stopId === stop.stop_id
          );
          
          if (isStopInDirection) {
            // Encontrar un trip para obtener el headsign
            const directionalTrips = trips.filter(
              (trip: any) => trip.route_id === route.route_id && trip.direction_id === directionId
            );
            
            const headsign = directionalTrips.length > 0 ? directionalTrips[0].trip_headsign : '';
            
            // Agregar resultado
            results.push({
              stop,
              route,
              direction: directionId,
              headsign
            });
          }
        }
      }
    }
    
    return NextResponse.json(results);
  } catch (error) {
    console.error(`Error en la búsqueda: ${error}`);
    return NextResponse.json(
      { error: 'Error en la búsqueda' },
      { status: 500 }
    );
  }
}
