// src/app/api/directions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Interfaces (ajustar direction_id si siempre es string en el JSON, o convertir al comparar)
interface Trip {
    route_id: string;
    service_id: string; 
    trip_id: string;    
    trip_headsign?: string;
    direction_id: string | number; // Hacerlo más flexible o elegir uno y convertir
    block_id?: string;
    shape_id?: string;
}

interface StopOnRoute {
    stopId: string;
    stopName: string;
    sequence: number; 
}

type TripsData = Trip[];
type RouteToStopsData = Record<string, StopOnRoute[]>; 

export interface DirectionOption {
    stopId: string;         
    lineId: string;         
    selectedStopName: string; 
    directionDisplayName: string; 
    rawDirectionId: number; 
}

function loadJsonData<T>(fileName: string): T | null {
    const filePath = path.join(process.cwd(), 'public/data', fileName);
    if (!fs.existsSync(filePath)) {
        console.error(`Error: Archivo no encontrado - ${filePath}`);
        return null;
    }
    try {
        const fileData = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileData) as T;
    } catch (error) {
        console.error(`Error al leer o parsear el archivo ${fileName}:`, error);
        return null;
    }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const routeId = searchParams.get('routeId');
    const stopNameParam = searchParams.get('stopName');

    if (!routeId || !stopNameParam) {
        return NextResponse.json(
            { error: 'Se requieren los parámetros routeId y stopName' },
            { status: 400 }
        );
    }

    try {
        const trips = loadJsonData<TripsData>('trips.json');
        const routeToStops = loadJsonData<RouteToStopsData>('route_to_stops.json');
        const routesData = loadJsonData<any[]>('routes.json'); // Para el fallback de nombre de ruta

        if (!trips || !routeToStops || !routesData) {
            return NextResponse.json(
                { error: 'No se pudieron cargar los datos necesarios del servidor' },
                { status: 500 }
            );
        }

        const resultingDirections: DirectionOption[] = [];

        for (const currentDirectionIdNum of [0, 1]) { // currentDirectionIdNum es NÚMERO
            const directionKey = `${routeId}_${currentDirectionIdNum}`;
            const stopsInCurrentDirection = routeToStops[directionKey];

            if (stopsInCurrentDirection && Array.isArray(stopsInCurrentDirection)) {
                const foundStop = stopsInCurrentDirection.find(
                    (stop: StopOnRoute) => stop.stopName === stopNameParam
                );

                if (foundStop) {
                    let headsign = "Dirección Desconocida"; // Fallback inicial

                    // Opción A: Convertir currentDirectionIdNum a string para la comparación
                    const currentDirectionIdStr = currentDirectionIdNum.toString();

                    const relevantTrip = trips.find(
                        (trip: Trip) => 
                            trip.route_id === routeId && 
                            trip.direction_id.toString() === currentDirectionIdStr && // Compara string con string
                            trip.trip_headsign && trip.trip_headsign.trim() !== ""
                    );

                    if (relevantTrip) {
                        // trip_headsign ya fue validado en la condición del find
                        headsign = relevantTrip.trip_headsign!; // Usar '!' porque ya sabemos que no es null/undefined/vacío
                    } else {
                        console.warn(`No se encontró trip_headsign para ${routeId}, direction_id ${currentDirectionIdNum}. Intentando fallback con nombre de ruta.`);
                        // Fallback usando route_long_name
                        const routeDetails = routesData.find(r => r.route_id === routeId);
                        if (routeDetails && routeDetails.route_long_name) {
                           const parts = routeDetails.route_long_name.split(' - ');
                           if (parts.length === 2) {
                               headsign = currentDirectionIdNum === 0 ? parts[0] : parts[1];
                               console.log(`   Fallback usando nombre de ruta: Hacia ${headsign}`);
                           } else {
                               console.warn(`   Nombre de ruta '${routeDetails.route_long_name}' no tiene el formato esperado para fallback.`);
                           }
                        } else {
                            console.warn(`   No se encontró route_long_name para ${routeId} para el fallback.`);
                        }
                    }
                    
                    resultingDirections.push({
                        stopId: foundStop.stopId,
                        lineId: routeId,
                        selectedStopName: stopNameParam,
                        directionDisplayName: `Hacia ${headsign}`,
                        rawDirectionId: currentDirectionIdNum
                    });
                }
            }
        }

        if (resultingDirections.length === 0) {
             return NextResponse.json(
                { error: `No se encontró la parada '${stopNameParam}' en la ruta '${routeId}' o no hay información de dirección.` },
                { status: 404 }
            );
        }
        return NextResponse.json(resultingDirections);

    } catch (error) {
        console.error(`Error al obtener direcciones para la ruta ${routeId} y parada '${stopNameParam}':`, error);
        return NextResponse.json(
            { error: 'Error interno del servidor al procesar la solicitud de direcciones' },
            { status: 500 }
        );
    }
}