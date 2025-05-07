// src/app/api/realtime/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// --- INTERFACES (Basadas en la estructura esperada del API externa y nuestra respuesta) ---
interface ExternalApiArrivalDepartureInfo {
  time?: number; 
  delay?: number; 
}
interface ExternalApiStation {
  stop_id: string; 
  stop_name: string;
  arrival?: ExternalApiArrivalDepartureInfo;
  departure?: ExternalApiArrivalDepartureInfo;
}
interface ExternalApiTripLinea {
  Trip_Id: string;
  Route_Id: string;
  Direction_ID: number | string; 
  start_time: string;
  start_date: string;
  Estaciones: ExternalApiStation[];
}
interface ExternalApiEntity {
  ID: string; 
  Linea: ExternalApiTripLinea;
}
interface ExternalApiResponse {
  Header: { timestamp: number }; 
  Entity: ExternalApiEntity[];   
}

// --- INTERFACES PARA NUESTRA RESPUESTA (LO QUE ESPERA ArrivalsView) ---
interface Arrival {
  tripId: string; 
  routeId: string;
  headsign: string; 
  estimatedArrivalTime: number; // Timestamp en SEGUNDOS
  delaySeconds: number; 
  status: 'on-time' | 'delayed' | 'early' | 'unknown';
  departureTimeFromTerminal?: string; 
  vehicleId?: string; 
}
interface StopOnLine { 
  stopId: string;
  stopName: string;
  sequence: number; 
}
interface VehiclePosition {
  tripId: string; 
  currentStopId?: string | null; 
  nextStopId?: string | null;    
}

type RouteToStopsData = Record<string, { stopId: string; stopName: string; sequence: number }[]>;
interface LocalTrip {
    route_id: string;
    service_id: string;
    trip_id: string;
    trip_headsign?: string;
    trip_short_name?: string; 
    direction_id: string | number; 
    block_id?: string;
    shape_id?: string;
}

// --- Funciones Helper ---
function loadLocalJsonData<T>(filePathFromPublic: string): T | null {
    const fullPath = path.join(process.cwd(), 'public', filePathFromPublic);
    if (!fs.existsSync(fullPath)) {
        console.error(`[API /api/realtime] Error: Archivo local no encontrado - ${fullPath}`);
        return null;
    }
    try {
        const fileData = fs.readFileSync(fullPath, 'utf8');
        return JSON.parse(fileData) as T;
    } catch (error) {
        console.error(`[API /api/realtime] Error al leer/parsear archivo local ${filePathFromPublic}:`, error);
        return null;
    }
}

// --- Handler GET ---
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const routeIdParam = searchParams.get('routeId');
  const stopIdParam = searchParams.get('stopId'); // Parada de interés para el usuario
  const directionIdParam = searchParams.get('direction'); // "0" o "1"

  console.log(`[API /api/realtime] Request: R:${routeIdParam}, S:${stopIdParam}, D:${directionIdParam}`);

  if (!routeIdParam || !stopIdParam || !directionIdParam) {
    console.error("[API /api/realtime] Error: Parámetros incompletos.");
    return NextResponse.json({ error: 'Se requieren routeId, stopId y direction' }, { status: 400 });
  }

  const CLIENT_ID = process.env.SUBTE_API_CLIENT_ID;
  const CLIENT_SECRET = process.env.SUBTE_API_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error("[API /api/realtime] Error: Credenciales API no configuradas.");
      return NextResponse.json({ error: 'Error de config del servidor (realtime).' },{ status: 500 });
  }

  try { // Inicio bloque try
    // --- CAMBIO: VOLVER A USAR FETCH ---
    console.log(`[API /api/realtime] Iniciando fetch a API de transporte para Subtes.`);
    const externalResponse = await fetch(
      `https://apitransporte.buenosaires.gob.ar/subtes/forecastGTFS?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
      { 
          method: 'GET', // Especificar método GET
          headers: { // Añadir headers si son necesarios (ej. Aceptar JSON)
              'Accept': 'application/json',
          },
          next: { revalidate: 20 } // Revalidar caché cada 20 segundos
      } 
    );
    // --- FIN DEL CAMBIO ---

    if (!externalResponse.ok) {
      const errorBody = await externalResponse.text(); 
      console.error(`[API /api/realtime] Error desde API externa: ${externalResponse.status} ${externalResponse.statusText}. Respuesta: ${errorBody.substring(0, 500)}...`); 
      // Devolver un error más informativo al cliente si es posible
      let errorMsg = `Error ${externalResponse.status} al contactar servicio de subterráneos.`;
      if (externalResponse.status === 401 || externalResponse.status === 403) {
          errorMsg = "Error de autenticación con el servicio de subterráneos. Revisa las credenciales.";
      } else if (externalResponse.status === 429) {
          errorMsg = "Límite de peticiones excedido al servicio de subterráneos.";
      }
      // Puedes intentar parsear el errorBody como JSON si esperas un formato específico
      // try { const parsedError = JSON.parse(errorBody); errorMsg = parsedError.message || errorMsg; } catch(e){}
      return NextResponse.json({ error: errorMsg }, { status: 502 }); // 502 Bad Gateway es apropiado
    }

    const externalData: ExternalApiResponse = await externalResponse.json();
    
    // Validación básica de la respuesta
    if (!externalData || !externalData.Header || !externalData.Entity) {
        console.error("[API /api/realtime] Error: Respuesta de API externa inválida o incompleta.");
        throw new Error("Respuesta inválida del servicio de subterráneos.");
    }

    console.log(`[API /api/realtime] Respuesta API externa OK: Timestamp ${externalData.Header.timestamp}, Entidades ${externalData.Entity.length}`);

    const processedArrivals: Arrival[] = [];
    const processedVehicles: VehiclePosition[] = [];
    const targetDirectionIdNum = parseInt(directionIdParam, 10);

    const localTripsData = loadLocalJsonData<LocalTrip[]>('data/trips.json'); 

    console.log(`[API /api/realtime] Procesando entidades para R:${routeIdParam}, D:${targetDirectionIdNum}. Parada usuario:${stopIdParam}`);

    externalData.Entity.forEach((entity: ExternalApiEntity) => { // Inicio forEach entity
      const tripInfo = entity.Linea;
      let tripDirectionIdNum: number | null = null;
      if (tripInfo.Direction_ID !== undefined && tripInfo.Direction_ID !== null) {
          const parsedNum = parseInt(tripInfo.Direction_ID.toString(), 10);
          if (!isNaN(parsedNum)) tripDirectionIdNum = parsedNum;
      }

      if (tripInfo.Route_Id === routeIdParam && tripDirectionIdNum === targetDirectionIdNum) { // Inicio if trip coincide
        let stopForArrivalCalculationFound = false;
        let vehicleCurrentStop: ExternalApiStation | null = null;
        let vehicleNextStop: ExternalApiStation | null = null;
        const nowTimestamp = externalData.Header.timestamp;

        for (let i = 0; i < tripInfo.Estaciones.length; i++) { // Inicio for estaciones
          const estacion: ExternalApiStation = tripInfo.Estaciones[i];
          
          // --- Cálculo de Llegadas ---
          if (estacion.stop_id === stopIdParam) {
            stopForArrivalCalculationFound = true;
            const arrivalTime = estacion.arrival?.time;
            // Solo procesar si hay tiempo de llegada y es futuro o muy reciente
            if (arrivalTime !== undefined && arrivalTime >= nowTimestamp - 60) { 
              const delayInSeconds = estacion.arrival?.delay !== undefined ? Number(estacion.arrival.delay) : 0;
              let arrivalStatus: Arrival['status'] = 'unknown';
              if (delayInSeconds === 0) arrivalStatus = 'on-time';
              else if (delayInSeconds < 0 && delayInSeconds >= -180) arrivalStatus = 'early'; 
              else if (delayInSeconds < -180 || delayInSeconds > 180) arrivalStatus = 'delayed'; 
              
              let officialTripHeadsign = "Desconocido";
              if (localTripsData) {
                  const matchingLocalTrip = localTripsData.find((t: LocalTrip) => 
                      t.route_id === tripInfo.Route_Id && 
                      t.direction_id?.toString() === tripDirectionIdNum?.toString() && 
                      t.trip_headsign && t.trip_headsign.trim() !== ""
                  );
                  if (matchingLocalTrip?.trip_headsign) officialTripHeadsign = matchingLocalTrip.trip_headsign;
                  else officialTripHeadsign = tripInfo.Estaciones[tripInfo.Estaciones.length - 1]?.stop_name || 'Desconocido';
              } else {
                  officialTripHeadsign = tripInfo.Estaciones[tripInfo.Estaciones.length - 1]?.stop_name || 'Desconocido';
              }
              
              processedArrivals.push({
                tripId: entity.ID, routeId: tripInfo.Route_Id, headsign: officialTripHeadsign,
                estimatedArrivalTime: arrivalTime, delaySeconds: delayInSeconds, status: arrivalStatus,
                departureTimeFromTerminal: tripInfo.start_time, vehicleId: entity.ID,
              });
            }
          } // Fin if parada de interés

          // --- Cálculo Posición Vehículo ---
          const arrivalTime = estacion.arrival?.time;
          const departureTime = estacion.departure?.time;
          if (arrivalTime !== undefined) {
              if (arrivalTime <= nowTimestamp) { 
                  vehicleCurrentStop = estacion; 
                  vehicleNextStop = (i + 1 < tripInfo.Estaciones.length) ? tripInfo.Estaciones[i + 1] : null;
              } else { 
                  if (!vehicleNextStop) { 
                      vehicleNextStop = estacion; 
                      if (i === 0 && !vehicleCurrentStop) vehicleCurrentStop = null; 
                  }
                  break; 
              }
          } // Fin if arrivalTime existe
        } // Fin for estaciones

        // Agregar vehículo a la lista (todos los de la línea/dirección)
        processedVehicles.push({
            tripId: entity.ID,
            currentStopId: vehicleCurrentStop?.stop_id || null,
            nextStopId: vehicleNextStop?.stop_id || null,
        });

      } // Fin if trip coincide
    }); // Fin forEach entity

    processedArrivals.sort((a, b) => a.estimatedArrivalTime - b.estimatedArrivalTime);
    
    // --- Logging Final ---
    if (processedArrivals.length > 0) {
        console.log(`[API /api/realtime] Próximas llegadas para ${stopIdParam} (R:${routeIdParam} D:${directionIdParam}):`);
        processedArrivals.forEach((arr: Arrival) => {
            const arrivalD = new Date(arr.estimatedArrivalTime * 1000);
            const serverNow = new Date();
            const minutesDiff = Math.max(0, Math.round((arrivalD.getTime() - serverNow.getTime()) / (1000 * 60)));
            console.log(`  - Trip ${arr.tripId} (Hacia ${arr.headsign}): ${minutesDiff} min (ETA: ${arrivalD.toLocaleTimeString('es-AR')}, Delay: ${arr.delaySeconds}s)`);
        });
    } else {
        console.log(`[API /api/realtime] No se encontraron llegadas futuras para ${stopIdParam} (R:${routeIdParam} D:${directionIdParam}).`);
    }
    processedVehicles.forEach((v: VehiclePosition) => {
        console.log(`  - Vehículo/Servicio (ID ${v.tripId}): Desde ${v.currentStopId || 'Inicio'} -> Hacia ${v.nextStopId || 'Terminal'}`);
    });

    const routeToStops = loadLocalJsonData<RouteToStopsData>('data/route_to_stops.json');
    let stopsForLineView: StopOnLine[] = [];
    if (routeToStops) {
      const directionKey = `${routeIdParam}_${directionIdParam}`;
      stopsForLineView = routeToStops[directionKey] || [];
    }

    return NextResponse.json({
      arrivals: processedArrivals,
      stops: stopsForLineView,
      vehicles: processedVehicles, // Devolveremos la lista de vehículos/servicios activos
      timestamp: externalData.Header.timestamp * 1000 
    });

  } catch (error: any) { // Inicio CATCH
    console.error(`[API /api/realtime] CATCH BLOCK ERROR: ${error.message}`, error.stack);
    // Devolver un error genérico al cliente, el detalle ya se logueó
    return NextResponse.json({ error: 'Error al procesar datos en tiempo real.' }, { status: 500 });
  } // Fin CATCH
} // Fin export async function GET