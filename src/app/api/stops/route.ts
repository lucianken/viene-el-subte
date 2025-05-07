import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

// Definición de Tipos para los datos
// (Reutilizamos/redefinimos tipos similares al archivo anterior para claridad y autonomía del módulo)
interface Stop {
  stop_id: string; // Asumiendo que stop_id es un string, ajustar si es number
  stop_name: string;
  // Agrega otras propiedades de stop si existen y se usan
}

interface RouteStopInfo {
  stopId: string; // Debe coincidir con el tipo de Stop['stop_id']
  // Agrega otras propiedades si existen y se usan
}

interface RouteToStopsMap {
  [key: string]: RouteStopInfo[];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const routeId = searchParams.get('routeId');

  if (!routeId) {
    // Devolver todas las paradas
    const stopsPath = path.join(process.cwd(), 'public/data/stops.json');

    if (!fs.existsSync(stopsPath)) {
      return NextResponse.json(
        { error: 'No se encontraron datos de paradas' },
        { status: 404 }
      );
    }

    const stopsData = fs.readFileSync(stopsPath, 'utf8');
    const stops: Stop[] = JSON.parse(stopsData); // Tipado aquí

    return NextResponse.json(stops);
  } else {
    // Lógica para obtener paradas por ruta
    try {
      // Cargar el mapa de rutas a paradas
      const routeToStopsPath = path.join(
        process.cwd(),
        'public/data/route_to_stops.json'
      );
      const stopsPath = path.join(process.cwd(), 'public/data/stops.json');

      if (!fs.existsSync(routeToStopsPath) || !fs.existsSync(stopsPath)) {
        return NextResponse.json(
          { error: 'No se encontraron datos de paradas' },
          { status: 404 }
        );
      }

      // Leer archivos
      const routeToStopsData = fs.readFileSync(routeToStopsPath, 'utf8');
      const stopsData = fs.readFileSync(stopsPath, 'utf8');

      const routeToStops: RouteToStopsMap = JSON.parse(routeToStopsData); // Tipado aquí
      const allStops: Stop[] = JSON.parse(stopsData); // Tipado aquí

      // Buscar paradas para ambas direcciones
      const direction0Key = `${routeId}_0`;
      const direction1Key = `${routeId}_1`;

      const stopsDir0: RouteStopInfo[] = routeToStops[direction0Key] || [];
      const stopsDir1: RouteStopInfo[] = routeToStops[direction1Key] || [];

      // Combinar todas las paradas únicas
      const allStopIds = new Set<string>([ // Tipar el Set explícitamente
        ...stopsDir0.map((stop: RouteStopInfo) => stop.stopId), // Corregido el tipo aquí (Línea ~52)
        ...stopsDir1.map((stop: RouteStopInfo) => stop.stopId), // Corregido el tipo aquí (Línea ~53)
      ]);

      // Encontrar los objetos de parada completos
      const stopsResult: Stop[] = Array.from(allStopIds)
        .map((stopId) => {
          return allStops.find((stop: Stop) => stop.stop_id === stopId); // Corregido el tipo aquí (Línea ~58)
        })
        .filter((stop): stop is Stop => Boolean(stop)); // Type guard para filtrar undefined y afirmar Stop[]

      return NextResponse.json(stopsResult);
    } catch (error) {
      console.error(
        `Error al obtener paradas para la ruta ${routeId}:`,
        error
      );
      return NextResponse.json(
        { error: 'Error al obtener paradas' },
        { status: 500 }
      );
    }
  }
}