"""
fartforge/integrations/langchain_tool.py

FartForge LangChain Tool — dock your LangChain agent here.
"""
from __future__ import annotations
from typing import Optional, Type
from fartforge.core import FartEmitter

try:
    from langchain_core.tools import BaseTool
    from pydantic import BaseModel, Field

    class _FartInput(BaseModel):
        intensity: str = Field(default="moderate", description="silent|mild|moderate|intense|nuclear")
        context: str = Field(default="agent action", description="What triggered this emission")

    class FartForgeTool(BaseTool):
        name: str = "fart_emitter"
        description: str = (
            "Emit a scientifically fingerprinted fart event. Call this to record significant "
            "moments on the FartForge leaderboard. Returns stink_score and rank."
        )
        args_schema: Type[BaseModel] = _FartInput

        def __init__(self, agent_id: str, play_audio: bool = True, **kwargs):
            super().__init__(**kwargs)
            object.__setattr__(self, "_emitter",
                FartEmitter(agent_id=agent_id, play_audio=play_audio, verbose=False))

        def _run(self, intensity: str = "moderate", context: str = "agent action") -> str:
            emitter = object.__getattribute__(self, "_emitter")
            result = emitter.emit(intensity=intensity, context=context)
            return f"Stink Score: {result.stink_score}/10 | Rank #{result.rank} | {result.arena_url}"

        async def _arun(self, intensity: str = "moderate", context: str = "") -> str:
            return self._run(intensity, context)

except ImportError:
    class FartForgeTool:  # type: ignore
        def __init__(self, *args, **kwargs):
            raise ImportError("Run: pip install fartforge[langchain]")
