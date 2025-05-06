import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const routeId = searchParams.get('routeId');
  
  if (!routeId) {
    // Devolver todas las paradas
    const stopsPath = path.join(process.cwd(), 'public/data/stops.json');
    
    if (!fs.existsSync(stopsPath)) {
      return NextResponse.json({ error: 'No se encontraron datos de paradas' }, { status: 404 });
    }
    
    const stopsData = fs.readFileSync(stopsPath, 'utf8');
    const stops = JSON.parse(stopsData);
    
    return NextResponse.json(stops);
  } else {
    // Lógica para obtener paradas por ruta
    try {
      // Cargar el mapa de rutas a paradas
      const routeToStopsPath = path.join(process.cwd(), 'public/data/route_to_stops.json');
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
      
      const routeToStops = JSON.parse(routeToStopsData);
      const allStops = JSON.parse(stopsData);
      
      // Buscar paradas para ambas direcciones
      const direction0Key = `${routeId}_0`;
      const direction1Key = `${routeId}_1`;
      
      const stopsDir0 = routeToStops[direction0Key] || [];
      const stopsDir1 = routeToStops[direction1Key] || [];
      
      // Combinar todas las paradas únicas
      const allStopIds = new Set([
        ...stopsDir0.map((stop: any) => stop.stopId),
        ...stopsDir1.map((stop: any) => stop.stopId)
      ]);
      
      // Encontrar los objetos de parada completos
      const stops = Array.from(allStopIds).map(stopId => {
        return allStops.find((stop: any) => stop.stop_id === stopId);
      }).filter(Boolean);
      
      return NextResponse.json(stops);
    } catch (error) {
      console.error(`Error al obtener paradas para la ruta ${routeId}:`, error);
      return NextResponse.json(
        { error: 'Error al obtener paradas' },
        { status: 500 }
      );
    }
  }
}