from fastapi import APIRouter
from app.api.endpoints.datasets import router as datasets_router

api_router = APIRouter()


@api_router.get('/health')
async def health_check() -> dict[str, str]:
    return {'status': 'ok', 'service': 'InsightX AI API'}

api_router.include_router(datasets_router, prefix="/datasets", tags=["datasets"])
