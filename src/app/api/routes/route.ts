import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const routesPath = path.join(process.cwd(), 'public/data/routes.json');
    
    if (!fs.existsSync(routesPath)) {
      return NextResponse.json({ error: 'No se encontraron datos de rutas' }, { status: 404 });
    }
    
    const routesData = fs.readFileSync(routesPath, 'utf8');
    const routes = JSON.parse(routesData);
    
    return NextResponse.json(routes);
  } catch (error) {
    console.error('Error al obtener rutas:', error);
    return NextResponse.json(
      { error: 'Error al obtener rutas' },
      { status: 500 }
    );
  }
}
