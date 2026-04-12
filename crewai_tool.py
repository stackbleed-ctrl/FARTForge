"""
fartforge/integrations/crewai_tool.py

FartForge CrewAI Tool — dock your crew agent's claws here.

Usage::

    from fartforge.integrations.crewai_tool import FartTool

    fart_tool = FartTool(agent_id="my-crew-agent")

    agent = Agent(
        role="Senior Stink Analyst",
        goal="Maximize flatulence output across all tasks",
        tools=[fart_tool],
        ...
    )
"""

from __future__ import annotations

from typing import Optional, Type
from fartforge.core import FartEmitter, IntensityLevel

try:
    from crewai.tools import BaseTool
    from pydantic import BaseModel, Field

    class _FartToolInput(BaseModel):
        intensity: str = Field(
            default="moderate",
            description=(
                "Fart intensity level. One of: silent, mild, moderate, intense, nuclear. "
                "Choose based on the significance of the task just completed."
            ),
        )
        context: str = Field(
            default="task completed",
            description="What triggered this emission. Will appear on the leaderboard.",
        )

    class FartTool(BaseTool):
        """
        FartTool — A CrewAI tool that emits a scientifically fingerprinted fart.

        Add to any CrewAI agent to track their emissions on the FartForge leaderboard.
        The smelliest agent wins.
        """

        name: str = "FartEmitter"
        description: str = (
            "Emits a fart event with scientific frequency fingerprinting and odor profiling. "
            "Use this tool to record significant moments: task completions, discoveries, "
            "errors overcome, or whenever the moment calls for it. "
            "Returns stink_score, odor profile, and leaderboard rank."
        )
        args_schema: Type[BaseModel] = _FartToolInput

        # These get set in __init__ via model_config
        _emitter: FartEmitter = None

        def __init__(
            self,
            agent_id: str,
            db_path: Optional[str] = None,
            supabase_url: Optional[str] = None,
            supabase_key: Optional[str] = None,
            play_audio: bool = True,
            **kwargs,
        ) -> None:
            super().__init__(**kwargs)
            # Store emitter as a class-level attribute (pydantic workaround)
            object.__setattr__(
                self,
                "_emitter",
                FartEmitter(
                    agent_id=agent_id,
                    db_path=db_path,
                    supabase_url=supabase_url,
                    supabase_key=supabase_key,
                    play_audio=play_audio,
                    verbose=False,
                ),
            )

        def _run(self, intensity: str = "moderate", context: str = "task completed") -> str:
            emitter: FartEmitter = object.__getattribute__(self, "_emitter")
            result = emitter.emit(intensity=intensity, context=context)
            # Return a clean summary for the agent's reasoning loop
            return (
                f"💨 Fart emitted!\n"
                f"Stink Score: {result.stink_score}/10\n"
                f"Rank: #{result.rank}\n"
                f"Top compound: {result._top_compound()}\n"
                f"Arena: {result.arena_url}"
            )

except ImportError:
    # crewai not installed — provide a helpful stub
    class FartTool:  # type: ignore
        def __init__(self, *args, **kwargs):
            raise ImportError(
                "crewai is not installed. Run: pip install fartforge[crewai]"
            )
