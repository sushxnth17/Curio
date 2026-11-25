from abc import ABC, abstractmethod
from typing import Iterator, Type, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class BaseAIProvider(ABC):
    """
    Minimal AI provider abstraction.
    Decouples Curio AI logic from specific LLM providers (Groq, Mock).
    """

    @abstractmethod
    def generate_structured(self, prompt: str, response_model: Type[T]) -> T:
        """
        Generate structured output from LLM using Pydantic validation.
        """
        pass

    @abstractmethod
    def generate_text(self, prompt: str) -> str:
        """
        Generate basic text output from LLM.
        """
        pass

    def generate_text_stream(self, prompt: str) -> Iterator[str]:
        """
        Stream text chunks from LLM. Default implementation yields full text.
        """
        yield self.generate_text(prompt)


# Backward compatibility alias for existing code
BaseLLMProvider = BaseAIProvider
