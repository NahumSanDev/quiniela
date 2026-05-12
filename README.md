# Quiniela Mundial - Sistema de Predicciones para el Mundial de Fútbol

## Descripción
Aplicación de quiniela escalable y segura para el Mundial de Fútbol, con sistema de puntuación 3+1, ranking en tiempo real y diseño premium dark mode.

## Stack Tecnológico
- **Frontend**: Next.js 14 + Tailwind CSS + Framer Motion
- **Backend**: Node.js + Express + Prisma ORM
- **Base de Datos**: PostgreSQL (Railway)
- **Despliegue**: Vercel (Frontend) + Railway (Backend)
- **API Externa**: API-Football para resultados y horarios

## Reglas de Negocio

### Sistema de Puntuación (3+1)
- **+3 puntos**: Acertar Ganador o Empate
- **+1 punto adicional**: Acertar Marcador Exacto (acumulativo)

### Desempate (Ranking)
1. Mayor cantidad de puntos (DESC)
2. Menor timestamp de última predicción actualizada (ASC - primero en actualizar gana)

### Seguridad
- Bloqueo de edición: Se verifica contra `match.start_time` en el servidor
- No se confía en la hora del cliente
- Validación en backend: `server_time >= match.start_time` =bloquear

## Estructura del Proyecto
```
quiniela/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── routes/
│   │   ├── models/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── lib/
│   └── package.json
└── README.md
```

## Scripts Disponibles

### Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Variables de Entorno Requeridas

### Backend (.env)
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
API_FOOTBALL_KEY=your-api-key
PORT=3001
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

## Flujo de Datos

1. **Sincronización**: API-Football actualiza Matches (horarios, resultados)
2. **Predicción**: Usuario selecciona marcador → Backend valida tiempo → Guardar
3. **Cálculo**: Al marcar partido como "Finished" → Disparar cálculo de puntos
4. **Ranking**: Actualizar leaderboard en tiempo real

## Endpoints Principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /api/matches | Lista de partidos |
| POST | /api/predictions | Crear/actualizar predicción |
| GET | /api/ranking | Tabla de posiciones |
| GET | /api/users/:id | Perfil de usuario |
| POST | /api/webhooks/football | Webhook para resultados |