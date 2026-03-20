# Wave Browser Development Guidelines

This document guides AI agents (like GitHub Copilot) on how to make coordinated changes across the frontend and backend.

## Architecture Overview

```
Frontend (React/TypeScript)     Backend (FastAPI/Python)
├── src/api/types.ts       ←→   app/models.py
├── src/api/client.ts      ←→   app/routers/*.py
├── mocks/handlers.ts      ←→   (mirrors real API)
└── src/components/        ←→   (consumes API)
```

## API Contract Rules

When modifying API endpoints:

1. **Backend First**: Update the endpoint in `backend/app/routers/`
2. **Update Types**: Update `frontend/src/api/types.ts` with matching TypeScript interfaces
3. **Update Client**: Update `frontend/src/api/client.ts` with new API methods
4. **Update Mocks**: Update `frontend/mocks/handlers.ts` to match the real API
5. **Test Both**: Ensure both backend tests and frontend mocks work

### Type Mapping

| Python Type | TypeScript Type |
|-------------|-----------------|
| `str` | `string` |
| `int`, `float` | `number` |
| `bool` | `boolean` |
| `Optional[T]` | `T \| undefined` or `T?` |
| `List[T]` | `T[]` |
| `Dict[str, T]` | `Record<string, T>` |
| `Enum` | string union type |

## Adding a New Feature

### Example: Adding a new API endpoint

1. **Backend**: Create or update router
   ```python
   # backend/app/routers/new_feature.py
   @router.get("/endpoint")
   async def get_something() -> SomeResponse:
       ...
   ```

2. **Backend Models**: Define Pydantic models
   ```python
   # backend/app/models.py
   class SomeResponse(BaseModel):
       field: str
   ```

3. **Frontend Types**: Add matching TypeScript interface
   ```typescript
   // frontend/src/api/types.ts
   export interface SomeResponse {
     field: string;
   }
   ```

4. **Frontend Client**: Add API method
   ```typescript
   // frontend/src/api/client.ts
   export const newFeatureApi = {
     getSomething: () => request<SomeResponse>('/new-feature/endpoint'),
   };
   ```

5. **MSW Mock**: Add mock handler
   ```typescript
   // frontend/mocks/handlers.ts
   http.get('/api/new-feature/endpoint', () => {
     return HttpResponse.json({ field: 'mock value' });
   }),
   ```

## File Structure Conventions

### Backend
- `app/routers/` - API endpoints (one file per resource)
- `app/models.py` - Pydantic models for API
- `app/services/` - Business logic
- `adapters/` - External integrations (Verdi, etc.)

### Frontend
- `src/api/` - API client and types
- `src/components/` - React components
- `src/store/` - Zustand state management
- `src/hooks/` - Custom React hooks
- `mocks/` - MSW handlers for testing

## Testing

### Backend
```bash
cd backend
pytest
```

### Frontend (with mocks)
```powershell
.\scripts\dev-frontend-mock.ps1
```

### E2E (both running)
```powershell
# Terminal 1
.\scripts\dev-backend.ps1

# Terminal 2
.\scripts\dev-frontend.ps1
# Then open: http://localhost:5173?server=localhost:8000
```

## URL Parameters

The frontend supports connecting via URL parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `server` | Backend host:port | `?server=myhost:8000` |
| `fsdb` | File to open on connect | `&fsdb=/path/to/file.fsdb` |

Example: `http://localhost:5173?server=avidanus01:8000&fsdb=/home/user/dump.fsdb`

## Common Tasks

### Adding a button that calls the backend

1. Create/update the backend endpoint
2. Add the API method to `client.ts`
3. Add the mock handler to `handlers.ts`
4. Create the component that uses the API
5. Test with mocks first, then with real backend

### Changing an existing API response

1. Update the Pydantic model in `models.py`
2. Update the TypeScript interface in `types.ts`
3. Update the mock in `handlers.ts`
4. Update any components using the response
