import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

// Definición de Tipos para los datos
interface Stop {
  stop_id: string; // Asumiendo que stop_id es un string, ajustar si es number
  stop_name: string;
  // Agrega otras propiedades de stop si existen y se usan
}

interface Route {
  route_id: string; // Asumiendo que route_id es un string
  // Agrega otras propiedades de route si existen y se usan
}

interface Trip {
  route_id: string; // Asumiendo que route_id es un string
  direction_id: string; // '0' o '1'
  trip_headsign: string;
  // Agrega otras propiedades de trip si existen y se usan
}

interface RouteStopInfo {
  stopId: string; // Debe coincidir con el tipo de Stop['stop_id']
  // Agrega otras propiedades de routeStop si existen y se usan
}

interface RouteToStopsMap {
  [key: string]: RouteStopInfo[];
}

interface SearchResult {
  stop: Stop;
  route: Route;
  direction: string;
  headsign: string;
}

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
    const routeToStopsPath = path.join(
      process.cwd(),
      'public/data/route_to_stops.json'
    );

    if (
      !fs.existsSync(stopsPath) ||
      !fs.existsSync(routesPath) ||
      !fs.existsSync(tripsPath) ||
      !fs.existsSync(routeToStopsPath)
    ) {
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

    const stops: Stop[] = JSON.parse(stopsData);
    const routes: Route[] = JSON.parse(routesData);
    const trips: Trip[] = JSON.parse(tripsData);
    const routeToStops: RouteToStopsMap = JSON.parse(routeToStopsData);

    // Filtrar paradas por nombre
    const queryLower = query.toLowerCase();
    const matchingStops = stops.filter((stop: Stop) => // Corregido el tipo aquí
      stop.stop_name.toLowerCase().includes(queryLower)
    );

    // Limitar a 20 resultados para evitar respuestas muy grandes
    const limitedStops = matchingStops.slice(0, 20);

    // Para cada parada, buscar en qué rutas aparece
    const results: SearchResult[] = []; // Tipar el array de resultados

    for (const stop of limitedStops) {
      // Buscar en cada dirección de cada ruta
      for (const route of routes) {
        for (const directionId of ['0', '1']) {
          const directionKey = `${route.route_id}_${directionId}`;
          const stopsInDirection: RouteStopInfo[] = routeToStops[directionKey] || [];

          // Verificar si la parada está en esta dirección
          const isStopInDirection = stopsInDirection.some(
            (routeStop: RouteStopInfo) => routeStop.stopId === stop.stop_id // Corregido el tipo aquí
          );

          if (isStopInDirection) {
            // Encontrar un trip para obtener el headsign
            const directionalTrips = trips.filter(
              (trip: Trip) => // Corregido el tipo aquí
                trip.route_id === route.route_id &&
                trip.direction_id === directionId
            );

            const headsign =
              directionalTrips.length > 0
                ? directionalTrips[0].trip_headsign
                : '';

            // Agregar resultado
            results.push({
              stop,
              route,
              direction: directionId,
              headsign,
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