import os
from backend.app.ai.providers.base import BaseAIProvider, BaseLLMProvider
from backend.app.ai.providers.mock_provider import MockLLMProvider
from backend.app.ai.providers.groq_provider import GroqLLMProvider
from backend.app.core.config import settings


def create_ai_provider() -> BaseAIProvider:
    """
    Factory to construct the active AI provider based on configuration.
    Defaults to GroqLLMProvider with fallback to MockLLMProvider.
    """
    provider_name = (
        os.getenv("PRIMARY_AI_PROVIDER")
        or getattr(settings, "PRIMARY_AI_PROVIDER", "groq")
    ).lower()

    if provider_name == "mock":
        return MockLLMProvider()

    groq_key = os.getenv("GROQ_API_KEY") or getattr(settings, "GROQ_API_KEY", "")
    return GroqLLMProvider() if groq_key else MockLLMProvider()


__all__ = [
    "BaseAIProvider",
    "BaseLLMProvider",
    "MockLLMProvider",
    "GroqLLMProvider",
    "create_ai_provider",
]
